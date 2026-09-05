"""Shared resilience primitives: circuit breaker + HTTP-level retry.

Design notes (from plan-3766349cb86fba8f.md, Step 2.4):

- ``with_retry`` handles ONLY transport-level retries: 429, 5xx, timeout,
  network error. It does NOT retry on response-content errors (invalid JSON,
  empty response) — that is provider-specific and lives in the adapter.
- ``CircuitBreaker`` tracks consecutive failures per provider. When the count
  reaches ``failure_threshold``, subsequent calls fail fast with
  ``GradingError(kind="circuit_open")`` for ``cooldown_seconds``.
- The Gemini Vision adapter does NOT use ``with_retry`` — it delegates to the
  existing ``gemini_vision.analyze_document`` which has a combined HTTP +
  content retry loop. The circuit breaker wraps the adapter entry point only.
"""
from __future__ import annotations

import asyncio
import logging
import random
import time
from typing import Any, Callable

import httpx

from ..gemini_vision import GradingError

logger = logging.getLogger("wiseos.resilience")

# Errors that indicate a transient provider problem (not a code bug).
_RETRYABLE_KINDS: set[str] = {
    "rate_limited",
    "server_error",
    "timeout",
    "network_error",
}

# httpx exceptions that map to retryable GradingError kinds.
_HTTPX_RETRYABLE: tuple[type[Exception], ...] = (
    httpx.TimeoutException,
    httpx.ConnectError,
    httpx.NetworkError,
)


def _classify_httpx_error(exc: Exception) -> str:
    """Map an httpx exception to a GradingError kind string."""
    if isinstance(exc, httpx.TimeoutException):
        return "timeout"
    if isinstance(exc, (httpx.ConnectError, httpx.NetworkError)):
        return "network_error"
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 429:
            return "rate_limited"
        if status >= 500:
            return "server_error"
        if status in (401, 403):
            return "auth_error"
        return "client_error"
    return "unknown"


class CircuitOpenError(GradingError):
    """Raised when the circuit breaker is open and the call is short-circuited."""

    def __init__(self, provider_name: str):
        super().__init__(
            f"Provider {provider_name} is temporarily unavailable (circuit open).",
            kind="circuit_open",
        )


class CircuitBreaker:
    """Tracks consecutive failures for a single provider.

    When ``failure_count`` reaches ``failure_threshold``, the circuit opens
    and calls are rejected immediately for ``cooldown_seconds``. A successful
    call during the cooldown resets the count and closes the circuit.

    Thread-safety: not explicitly synchronized — asyncio is single-threaded
    and the GIL protects simple attribute increments.
    """

    def __init__(
        self,
        *,
        failure_threshold: int = 5,
        cooldown_seconds: float = 60.0,
        provider_name: str = "unknown",
    ) -> None:
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.provider_name = provider_name
        self._failure_count = 0
        self._opened_at: float = 0.0  # time.monotonic() when circuit opened

    @property
    def is_open(self) -> bool:
        if self._failure_count < self.failure_threshold:
            return False
        elapsed = time.monotonic() - self._opened_at
        return elapsed < self.cooldown_seconds

    def check(self) -> None:
        """Raise CircuitOpenError if the circuit is open."""
        if self.is_open:
            remaining = self.cooldown_seconds - (time.monotonic() - self._opened_at)
            logger.warning(
                "circuit_open provider=%s remaining=%.1fs",
                self.provider_name, remaining,
            )
            raise CircuitOpenError(self.provider_name)

    def record_success(self) -> None:
        """Reset failure count and close the circuit."""
        if self._failure_count > 0:
            logger.info(
                "circuit_closed provider=%s previous_failures=%d",
                self.provider_name, self._failure_count,
            )
        self._failure_count = 0
        self._opened_at = 0.0

    def record_failure(self) -> None:
        """Increment failure count; open circuit if threshold reached."""
        self._failure_count += 1
        if self._failure_count >= self.failure_threshold:
            if self._opened_at == 0.0:
                self._opened_at = time.monotonic()
                logger.warning(
                    "circuit_breaker_opened provider=%s failures=%d cooldown=%.0fs",
                    self.provider_name, self._failure_count, self.cooldown_seconds,
                )

    @property
    def failure_count(self) -> int:
        return self._failure_count


async def with_retry(
    func: Callable,
    *,
    max_attempts: int = 3,
    backoff_base: float = 2.0,
    backoff_max: float = 30.0,
    retryable_kinds: set[str] | None = None,
    timeout: float = 60.0,
    circuit: CircuitBreaker | None = None,
) -> Any:
    """Call ``func`` with transport-level retry and optional circuit breaker.

    ``func`` must be an async callable that takes no arguments.

    Retries on:
      - httpx.TimeoutException, httpx.ConnectError, httpx.NetworkError
      - httpx.HTTPStatusError with status 429 or 5xx
      - GradingError with kind in ``retryable_kinds``

    Does NOT retry on:
      - GradingError kinds not in ``retryable_kinds`` (e.g. auth_error)
      - Non-httpx/non-GradingError exceptions
      - Response-content errors (invalid_json, empty_response) — those are
        provider-specific and must be handled inside ``func``.

    If ``circuit`` is provided, it is checked before each call and failures
    are recorded. When the circuit opens, ``CircuitOpenError`` is raised
    immediately without calling ``func``.
    """
    if retryable_kinds is None:
        retryable_kinds = _RETRYABLE_KINDS

    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        if circuit is not None:
            circuit.check()

        try:
            result = await asyncio.wait_for(func(), timeout=timeout)
            if circuit is not None:
                circuit.record_success()
            return result
        except GradingError as e:
            last_error = e
            if circuit is not None and e.kind in retryable_kinds:
                circuit.record_failure()
            elif circuit is not None:
                # Non-retryable errors don't count toward circuit health.
                pass
            if e.kind not in retryable_kinds or attempt == max_attempts:
                raise
        except _HTTPX_RETRYABLE as e:
            kind = _classify_httpx_error(e)
            last_error = GradingError(str(e), kind=kind)
            if circuit is not None:
                circuit.record_failure()
            if attempt == max_attempts:
                raise GradingError(str(e), kind=kind) from e
        except httpx.HTTPStatusError as e:
            kind = _classify_httpx_error(e)
            last_error = GradingError(str(e), kind=kind)
            if circuit is not None and kind in retryable_kinds:
                circuit.record_failure()
            if kind not in retryable_kinds or attempt == max_attempts:
                raise GradingError(str(e), kind=kind) from e
        except asyncio.TimeoutError as e:
            last_error = GradingError("Request timed out", kind="timeout")
            if circuit is not None:
                circuit.record_failure()
            if attempt == max_attempts:
                raise GradingError("Request timed out", kind="timeout") from e

        if attempt < max_attempts:
            delay = min(
                backoff_base ** (attempt - 1) + random.uniform(0, 0.5),
                backoff_max,
            )
            kind = getattr(last_error, "kind", "unknown")
            logger.info(
                "retry attempt=%d/%d kind=%s delay=%.1fs",
                attempt, max_attempts, kind, delay,
            )
            await asyncio.sleep(delay)

    raise last_error or RuntimeError("All retry attempts failed")
