"""Mathpix OCR-service med mock-fallback."""
from __future__ import annotations

import httpx

from ..config import settings
from ..schemas import OcrResponse


async def process_image(image_base64: str) -> OcrResponse:
    if not (settings.MATHPIX_APP_ID and settings.MATHPIX_APP_KEY):
        # Mock: realistiska fysik 1 elevarbeten för demo
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

    src = image_base64
    if not src.startswith("data:"):
        src = f"data:image/png;base64,{src}"

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
        return OcrResponse(latex="", text="", confidence=0.0)
