"""Anthropic feedback adapter — wraps feedback._generate_with_anthropic."""
from __future__ import annotations

from ...schemas import WolframResult
from ..feedback import SYSTEM_PROMPT, _feedback_message, _generate_with_anthropic, _safe_output
from .resilience import CircuitBreaker, with_retry


class AnthropicFeedbackAdapter:
    name = "anthropic"

    def __init__(self, circuit: CircuitBreaker) -> None:
        self._circuit = circuit

    async def generate_feedback(
        self,
        *,
        problem: str,
        student_answer: str,
        correct_answer: str,
        wolfram: WolframResult,
    ) -> tuple[str, str]:
        self._circuit.check()
        try:
            user_msg = _feedback_message(problem, student_answer, correct_answer, wolfram)
            text = await with_retry(
                lambda: _generate_with_anthropic(user_msg),
                circuit=self._circuit,
            )
            self._circuit.record_success()
            return _safe_output(text), self.name
        except Exception:
            self._circuit.record_failure()
            raise
