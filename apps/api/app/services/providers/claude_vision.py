"""Claude Vision adapter — wraps answer-key extraction AND grading via
services/claude_vision.py.

analyze_document uses no generic ``with_retry``: the service's own combined
HTTP + content retry loop already retries model-output errors — same design
as GeminiVisionAdapter and OpenAIVisionAdapter.
"""
from __future__ import annotations

import base64

from ...config import settings
from ...schemas import AnswerKeyItem, DocumentMeta, QuestionResult
from .. import claude_vision
from ..answer_key import SYSTEM_PROMPT, _parse_items
from .resilience import CircuitBreaker, with_retry


class ClaudeVisionAdapter:
    """Extracts answer keys AND grades documents via the Anthropic API."""

    name = "claude-vision"

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
            result = await claude_vision.analyze_document(
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

    async def extract_answer_key(
        self,
        file_bytes: bytes,
        mime_type: str,
    ) -> list[AnswerKeyItem]:
        self._circuit.check()
        try:
            items = await with_retry(
                lambda: self._call_anthropic(file_bytes, mime_type),
                circuit=self._circuit,
            )
            self._circuit.record_success()
            return items
        except Exception:
            self._circuit.record_failure()
            raise

    async def _call_anthropic(
        self, file_bytes: bytes, mime_type: str
    ) -> list[AnswerKeyItem]:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        encoded = base64.b64encode(file_bytes).decode("ascii")
        if mime_type == "application/pdf":
            media_block = {
                "type": "document",
                "source": {"type": "base64", "media_type": mime_type, "data": encoded},
            }
        else:
            media_block = {
                "type": "image",
                "source": {"type": "base64", "media_type": mime_type, "data": encoded},
            }
        msg = await client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=4000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": [media_block, {"type": "text", "text": "Extract this answer key."}]}],
        )
        text = "\n".join(b.text for b in msg.content if getattr(b, "type", None) == "text")
        return _parse_items(text)
