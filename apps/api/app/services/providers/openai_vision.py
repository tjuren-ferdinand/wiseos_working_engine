"""OpenAI Vision adapter — wraps services/openai_vision.py.

Same design as GeminiVisionAdapter: no generic ``with_retry`` — the service's
own combined HTTP + content retry loop already retries model-output errors
(invalid_json, empty_response, max_tokens). The circuit breaker wraps the
adapter entry point to fail fast when the provider is down.
"""
from __future__ import annotations

from ...schemas import AnswerKeyItem, DocumentMeta, QuestionResult
from .. import openai_vision
from .resilience import CircuitBreaker


class OpenAIVisionAdapter:
    name = "openai-vision"

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
            result = await openai_vision.analyze_document(
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
