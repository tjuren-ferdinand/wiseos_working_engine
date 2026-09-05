"""Wolfram adapter — wraps services/wolfram.py WolframVerifier."""
from __future__ import annotations

from ...schemas import WolframResult
from ..wolfram import WolframVerifier
from .resilience import CircuitBreaker, with_retry


class WolframAdapter:
    name = "wolfram"

    def __init__(self, circuit: CircuitBreaker) -> None:
        self._circuit = circuit
        self._inner = WolframVerifier()

    async def verify_equation(
        self,
        student_answer: str,
        correct_answer: str,
    ) -> WolframResult:
        self._circuit.check()
        try:
            result = await with_retry(
                lambda: self._inner.verify_equation(student_answer, correct_answer),
                circuit=self._circuit,
            )
            self._circuit.record_success()
            return result
        except Exception:
            self._circuit.record_failure()
            raise
