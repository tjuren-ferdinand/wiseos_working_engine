"""OpenAI Vision adapter — wraps vision_ocr._openai_style for OpenAI vision."""
from __future__ import annotations

import base64

from ...config import settings
from ...schemas import OcrResponse
from .. import vision_ocr
from .resilience import CircuitBreaker, with_retry


class OpenAIVisionOCRAdapter:
    name = "openai-vision"

    def __init__(self, circuit: CircuitBreaker) -> None:
        self._circuit = circuit

    async def extract(
        self,
        source: str,
        image_bytes: bytes,
        mime_type: str,
    ) -> OcrResponse:
        self._circuit.check()
        try:
            data_url = f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode('ascii')}"
            text = await with_retry(
                lambda: vision_ocr._openai_style(
                    "https://api.openai.com/v1/chat/completions",
                    settings.OPENAI_API_KEY,
                    settings.OPENAI_VISION_MODEL,
                    data_url,
                    vision_ocr.PROMPT,
                    token_param="max_completion_tokens",
                    timeout_seconds=settings.OPENAI_TIMEOUT_SECONDS,
                ),
                circuit=self._circuit,
            )
            self._circuit.record_success()
            return OcrResponse(
                latex=text,
                text=text,
                confidence=0.8,
                provider=self.name,
                status="degraded",
            )
        except Exception:
            self._circuit.record_failure()
            raise
