"""OCR-service med konfigurerbara Mathpix- och utvecklingsproviders."""
from __future__ import annotations

import base64
import binascii
from typing import Protocol

import httpx

from ..config import settings
from ..schemas import OcrResponse
from . import vision_ocr


class OCRProvider(Protocol):
    name: str

    async def extract(self, source: str, image_bytes: bytes, mime_type: str) -> OcrResponse: ...


class DevelopmentVisionOCRProvider:
    name = "development-vision"

    async def extract(self, source: str, image_bytes: bytes, mime_type: str) -> OcrResponse:
        text = await vision_ocr.read_image(image_bytes, mime_type)
        if not text:
            raise RuntimeError("Utvecklingsprovidern kunde inte läsa dokumentet.")
        return OcrResponse(
            latex=text,
            text=text,
            confidence=0.8,
            provider=vision_ocr.provider_name(),
            status="degraded",
        )


class MathpixOCRProvider:
    name = "mathpix"

    async def extract(self, source: str, image_bytes: bytes, mime_type: str) -> OcrResponse:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.mathpix.com/v3/text",
                headers={
                    "app_id": settings.MATHPIX_APP_ID,
                    "app_key": settings.MATHPIX_APP_KEY,
                    "Content-Type": "application/json",
                },
                json={"src": source, "formats": ["text", "latex_styled"], "data_options": {"include_latex": True}},
            )
        response.raise_for_status()
        data = response.json()
        return OcrResponse(
            latex=data.get("latex_styled") or data.get("text", ""),
            text=data.get("text", ""),
            confidence=float(data.get("confidence", 0.0) or 0.0),
            provider=self.name,
        )


def get_ocr_provider() -> OCRProvider:
    """Delegates to the provider registry for the active OCR provider."""
    from .providers.registry import get_ocr_provider as _registry_get

    return _registry_get()


def _decode_data_url(src: str) -> tuple[bytes, str] | None:
    if not src.startswith("data:") or ";base64," not in src:
        return None
    header, payload = src.split(";base64,", 1)
    mime = header[len("data:") :] or "image/png"
    try:
        return base64.b64decode(payload, validate=True), mime
    except (binascii.Error, ValueError):
        return None


async def process_image(image_base64: str) -> OcrResponse:
    source = image_base64 if image_base64.startswith("data:") else f"data:image/png;base64,{image_base64}"
    decoded = _decode_data_url(source)
    if not decoded:
        raise ValueError("Ogiltig bilddata (inte giltig base64).")
    return await get_ocr_provider().extract(source, decoded[0], decoded[1])
