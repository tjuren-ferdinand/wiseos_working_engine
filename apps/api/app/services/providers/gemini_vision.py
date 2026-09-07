"""Gemini Vision adapter — wraps services/gemini_vision.py.

IMPORTANT: This adapter does NOT use ``with_retry`` from resilience.py.
The existing ``gemini_vision.analyze_document`` has a combined HTTP + content
retry loop that retries on model-output errors (invalid_json, empty_response,
max_tokens) — errors that a generic HTTP retry layer cannot handle. The circuit
breaker wraps the adapter entry point to fail fast when the provider is down.
"""
from __future__ import annotations

from ...schemas import AnswerKeyItem, DocumentMeta, QuestionResult
from .. import gemini_vision
from .resilience import CircuitBreaker


class GeminiVisionAdapter:
    name = "gemini-vision"

    def __init__(self, circuit: CircuitBreaker) -> None:
        self._circuit = circuit

    async def analyze_document(
        self,
        *,
        pages: list[tuple[bytes, str]],
        answer_key: list[AnswerKeyItem],
        grading_notes: str,
        student_label: str,
    ) -> tuple[list[QuestionResult], DocumentMeta]:
        self._circuit.check()
        try:
            result = await gemini_vision.analyze_document(
                pages=pages,
                answer_key=answer_key,
                grading_notes=grading_notes,
                student_label=student_label,
            )
            self._circuit.record_success()
            return result
        except Exception:
            self._circuit.record_failure()
            raise
