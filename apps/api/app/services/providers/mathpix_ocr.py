"""Mathpix OCR adapter — wraps services/ocr.py MathpixOCRProvider."""
from __future__ import annotations

from ...schemas import OcrResponse
from ..ocr import MathpixOCRProvider
from .resilience import CircuitBreaker, with_retry


class MathpixOCRAdapter:
    name = "mathpix"

    def __init__(self, circuit: CircuitBreaker) -> None:
        self._circuit = circuit
        self._inner = MathpixOCRProvider()

    async def extract(
        self,
        source: str,
        image_bytes: bytes,
        mime_type: str,
    ) -> OcrResponse:
        self._circuit.check()
        try:
            result = await with_retry(
                lambda: self._inner.extract(source, image_bytes, mime_type),
                circuit=self._circuit,
            )
            self._circuit.record_success()
            return result
        except Exception:
            self._circuit.record_failure()
            raise
