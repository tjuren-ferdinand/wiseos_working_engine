"""Provider resilience tests — circuit breaker + retry layer.

Tests the shared resilience layer (CircuitBreaker, with_retry) in isolation,
then per-provider failure modes through the pipeline.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.gemini_vision import GradingError
from app.services.providers.resilience import (
    CircuitBreaker,
    CircuitOpenError,
    with_retry,
)

# ===========================================================================
# Dedicated circuit breaker tests — testing the resilience layer itself
# ===========================================================================


async def test_circuit_opens_after_threshold_failures():
    """After N consecutive failures, subsequent calls are short-circuited."""
    circuit = CircuitBreaker(failure_threshold=3, cooldown_seconds=60.0, provider_name="test")
    call_count = 0

    async def always_fails():
        nonlocal call_count
        call_count += 1
        raise GradingError("server error", kind="server_error")

    # First 3 calls: each raises server_error, circuit records the failure
    for i in range(3):
        with pytest.raises(GradingError, match="server error"):
            await with_retry(always_fails, max_attempts=1, circuit=circuit)
        assert call_count == i + 1

    # Circuit is now open — 4th call raises circuit_open WITHOUT calling the func
    call_count = 0  # reset to prove no call happened
    with pytest.raises(CircuitOpenError):
        await with_retry(always_fails, max_attempts=1, circuit=circuit)
    assert call_count == 0, "circuit_open should not invoke the function"


async def test_circuit_short_circuits_subsequent_calls():
    """Once open, the circuit rejects calls even if the mock would succeed."""
    circuit = CircuitBreaker(failure_threshold=2, cooldown_seconds=60.0, provider_name="test")
    call_count = 0

    async def fails():
        nonlocal call_count
        call_count += 1
        raise GradingError("server error", kind="server_error")

    # Trip the circuit
    for _ in range(2):
        with pytest.raises(GradingError):
            await with_retry(fails, max_attempts=1, circuit=circuit)

    # Now swap in a mock that would succeed — should still be short-circuited
    call_count = 0
    async def succeeds():
        nonlocal call_count
        call_count += 1
        return "ok"

    with pytest.raises(CircuitOpenError):
        await with_retry(succeeds, max_attempts=1, circuit=circuit)
    assert call_count == 0


async def test_circuit_closes_after_cooldown():
    """After cooldown, the circuit allows a call through and closes on success."""
    circuit = CircuitBreaker(failure_threshold=2, cooldown_seconds=0.01, provider_name="test")

    async def fails():
        raise GradingError("server error", kind="server_error")

    for _ in range(2):
        with pytest.raises(GradingError):
            await with_retry(fails, max_attempts=1, circuit=circuit)

    # Wait past the cooldown
    await asyncio.sleep(0.02)

    call_count = 0

    async def succeeds():
        nonlocal call_count
        call_count += 1
        return "ok"

    result = await with_retry(succeeds, max_attempts=1, circuit=circuit)
    assert result == "ok"
    assert call_count == 1
    assert circuit.failure_count == 0


async def test_circuit_resets_on_success():
    """Failures below threshold reset to 0 on success."""
    circuit = CircuitBreaker(failure_threshold=3, cooldown_seconds=60.0, provider_name="test")
    call_count = 0

    async def fails():
        nonlocal call_count
        call_count += 1
        raise GradingError("server error", kind="server_error")

    # 2 failures (below threshold of 3)
    for _ in range(2):
        with pytest.raises(GradingError):
            await with_retry(fails, max_attempts=1, circuit=circuit)
    assert circuit.failure_count == 2

    # Success resets
    async def succeeds():
        nonlocal call_count
        call_count += 1
        return "ok"

    result = await with_retry(succeeds, max_attempts=1, circuit=circuit)
    assert result == "ok"
    assert circuit.failure_count == 0


async def test_circuit_does_not_open_on_non_retryable_errors():
    """Auth errors (not retryable) do NOT increment the circuit failure count."""
    circuit = CircuitBreaker(failure_threshold=2, cooldown_seconds=60.0, provider_name="test")

    async def auth_error():
        raise GradingError("forbidden", kind="auth_error")

    for _ in range(5):
        with pytest.raises(GradingError, match="forbidden"):
            await with_retry(auth_error, max_attempts=1, circuit=circuit)

    # Circuit should NOT be open — auth errors are not provider health issues
    assert circuit.failure_count == 0
    assert not circuit.is_open


# ===========================================================================
# Per-provider failure-mode tests — testing adapters through the pipeline
# ===========================================================================


async def test_retry_on_429_then_success():
    """HTTP 429 on first call, 200 on second → with_retry succeeds."""
    circuit = CircuitBreaker(failure_threshold=5, cooldown_seconds=60.0, provider_name="test")
    call_count = 0

    async def flaky():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise GradingError("rate limited", kind="rate_limited")
        return "ok"

    result = await with_retry(flaky, max_attempts=3, circuit=circuit)
    assert result == "ok"
    assert call_count == 2


async def test_no_retry_on_403():
    """HTTP 403 → single attempt, no retry."""
    circuit = CircuitBreaker(failure_threshold=5, cooldown_seconds=60.0, provider_name="test")
    call_count = 0

    async def forbidden():
        nonlocal call_count
        call_count += 1
        raise GradingError("forbidden", kind="auth_error")

    with pytest.raises(GradingError, match="forbidden"):
        await with_retry(forbidden, max_attempts=3, circuit=circuit)
    assert call_count == 1


async def test_timeout_then_success():
    """Timeout on first call, success on second → with_retry retries."""
    circuit = CircuitBreaker(failure_threshold=5, cooldown_seconds=60.0, provider_name="test")
    call_count = 0

    async def flaky():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise GradingError("timed out", kind="timeout")
        return "ok"

    result = await with_retry(flaky, max_attempts=3, circuit=circuit)
    assert result == "ok"
    assert call_count == 2


async def test_provider_failure_yields_needs_review_not_crash():
    """Vision provider failure → pipeline returns needs_review, no exception.

    The real analyze_document never raises — it catches GradingError internally
    and returns results with needs_review status. This test verifies that the
    pipeline correctly propagates those needs_review results.
    """
    from unittest.mock import patch

    from app.schemas import (
        AnswerKeyItem,
        Assessment,
        DocumentMeta,
        QuestionResult,
    )
    from app.services.batch_pipeline import grade_batch, UploadedFile

    mock_meta = DocumentMeta(
        pageCount=1, model="test", questionsExpected=1,
        error="Provider unavailable", needsReviewCount=1,
    )
    mock_questions = [
        QuestionResult(
            questionNumber="1",
            found=False,
            studentWork="",
            assessment=Assessment(status="needs_review", points=0.0, maxPoints=1.0),
        )
    ]

    async def failing_analyze(**kwargs):
        return mock_questions, mock_meta

    with patch("app.services.batch_pipeline.get_vision_provider") as mock_get:
        mock_adapter = AsyncMock()
        mock_adapter.analyze_document = failing_analyze
        mock_adapter.name = "test-vision"
        mock_get.return_value = mock_adapter

        files = [
            UploadedFile(
                filename="test_student.png",
                content=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100,
                content_type="image/png",
            )
        ]

        results = await grade_batch(
            prov_id="test-prov",
            answer_key=[AnswerKeyItem(question_number="1", question_text="Q", final_answer="A")],
            class_grading_parameters="",
            test_specific_parameters="",
            files=files,
            identification_method="name_field",
        )

    assert len(results) == 1
    assert results[0].document.error is not None or results[0].document.needsReviewCount > 0
    # No fabricated score
    for r in results:
        for q in r.questions:
            assert q.assessment.points == 0.0
            assert q.assessment.status != "correct"
