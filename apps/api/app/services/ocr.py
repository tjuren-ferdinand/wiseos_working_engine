"""OCR-service: Mathpix → gratis vision-provider (ingen mock).

Mathpix kostar pengar, så en gratis vision-provider (se services/vision_ocr.py)
används tillfälligt för att läsa handskrivna elevsvar. Byt tillbaka genom att
sätta MATHPIX_APP_ID/KEY i .env.
"""
from __future__ import annotations

import base64
import binascii

import httpx

from ..config import settings
from ..schemas import OcrResponse
from . import vision_ocr


def _decode_data_url(src: str) -> tuple[bytes, str] | None:
    if not src.startswith("data:") or ";base64," not in src:
        return None
    header, payload = src.split(";base64,", 1)
    mime = header[len("data:") :] or "image/png"
    try:
        return base64.b64decode(payload), mime
    except (binascii.Error, ValueError):
        return None


async def process_image(image_base64: str) -> OcrResponse:
    src = image_base64
    if not src.startswith("data:"):
        src = f"data:image/png;base64,{src}"

    # Om Mathpix saknas, försök med Vision (Gemini/Groq)
    if not (settings.MATHPIX_APP_ID and settings.MATHPIX_APP_KEY):
        decoded = _decode_data_url(src)
        if not decoded:
            raise ValueError("Ogiltig bilddata (inte base64).")

        text = await vision_ocr.read_image(decoded[0], decoded[1])
        if text:
            return OcrResponse(latex=text, text=text, confidence=0.8)
        raise RuntimeError("OCR misslyckades: Alla konfigurerade Vision-providers nekade anropet.")

    # Om Mathpix är konfigurerat, använd det
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            "https://api.mathpix.com/v3/text",
            headers={
                "app_id": settings.MATHPIX_APP_ID,
                "app_key": settings.MATHPIX_APP_KEY,
                "Content-Type": "application/json",
            },
            json={"src": src, "formats": ["text", "latex_styled"], "data_options": {"include_latex": True}},
        )
        r.raise_for_status()
        data = r.json()
        return OcrResponse(
            latex=data.get("latex_styled") or data.get("text", ""),
            text=data.get("text", ""),
            confidence=float(data.get("confidence", 0.0) or 0.0),
        )
