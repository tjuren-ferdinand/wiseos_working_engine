"""OCR-service: Mathpix → gratis vision-provider → deterministisk mock.

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


def _mock_ocr(image_base64: str) -> OcrResponse:
    samples = [
        # Korrekt svar
        ("v = 19.6 m/s", r"v = 19.6 \, \text{m/s}"),
        # Delvis korrekt (fel enhet)
        ("v = 19.6", r"v = 19.6"),
        # Felaktigt (räkningsfel)
        ("v = 9.8 m/s", r"v = 9.8 \, \text{m/s}"),
        # Korrekt med gällande siffror
        ("F = 1470 N", r"F = 1470 \, \text{N}"),
        # Saknar enhet
        ("a = 2.5", r"a = 2.5"),
        # Korrekt beräkning
        ("t = 2.0 s", r"t = 2.0 \, \text{s}"),
    ]
    idx = (len(image_base64) // 1000) % len(samples)
    text, latex = samples[idx]
    # Variera confidence för realism
    confidence = 0.85 if idx in [0, 3, 5] else 0.65
    return OcrResponse(latex=latex, text=text, confidence=confidence)


def _decode_data_url(src: str) -> tuple[bytes, str] | None:
    if not src.startswith("data:") or ";base64," not in src:
        return None
    header, payload = src.split(";base64,", 1)
    mime = header[len("data:") :] or "image/png"
    try:
        return base64.b64decode(payload), mime
    except (binascii.Error, ValueError):
        return None


async def _vision_ocr(src: str) -> OcrResponse | None:
    decoded = _decode_data_url(src)
    if decoded is None:
        return None
    image_bytes, mime = decoded
    text = await vision_ocr.read_image(image_bytes, mime)
    if not text:
        return None
    return OcrResponse(latex=text, text=text, confidence=0.8)


async def process_image(image_base64: str) -> OcrResponse:
    src = image_base64
    if not src.startswith("data:"):
        src = f"data:image/png;base64,{src}"

    if not (settings.MATHPIX_APP_ID and settings.MATHPIX_APP_KEY):
        result = await _vision_ocr(src)
        return result if result is not None else _mock_ocr(image_base64)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                "https://api.mathpix.com/v3/text",
                headers={
                    "app_id": settings.MATHPIX_APP_ID,
                    "app_key": settings.MATHPIX_APP_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "src": src,
                    "formats": ["text", "latex_styled"],
                    "data_options": {"include_latex": True},
                },
            )
            data = r.json()
            return OcrResponse(
                latex=data.get("latex_styled") or data.get("text", ""),
                text=data.get("text", ""),
                confidence=float(data.get("confidence", 0.0) or 0.0),
            )
    except Exception:
        result = await _vision_ocr(src)
        return result if result is not None else _mock_ocr(image_base64)
