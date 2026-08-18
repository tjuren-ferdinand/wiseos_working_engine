"""Gratis vision-OCR-providers som tillfälligt ersätter Mathpix.

Providers provas i ordning tills en svarar:
1. Groq Vision  – gratis, men kräver att kontot har en multimodal modell.
2. Google Gemini – gratis nivå i AI Studio, mycket bra på handskrift.
3. OpenRouter    – gratis vision-modeller (t.ex. :free-varianter).

Alla är valfria: saknas nycklar returneras None och anroparen faller
tillbaka på Mathpix-mock. Byt till Mathpix genom att sätta MATHPIX_APP_ID/KEY.
"""
from __future__ import annotations

import base64

import httpx

from ..config import settings

PROMPT = (
    "Du är en OCR-motor för handskrivna prov i matematik och fysik. "
    "Läs av allt som eleven har skrivit på bilden, exakt som det står. "
    "Behåll uppgiftsnummer, mellanled, enheter och slutsvar. "
    "Svara enbart med den avlästa texten, utan kommentarer."
)

IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"}


def _normalize_mime(mime_type: str) -> str:
    mime = mime_type.split(";")[0].strip().lower()
    return "image/jpeg" if mime == "image/jpg" else mime


def is_image(mime_type: str) -> bool:
    return _normalize_mime(mime_type) in IMAGE_MIME_TYPES


def available() -> bool:
    return bool(settings.GROQ_API_KEY or settings.GEMINI_API_KEY or settings.OPENROUTER_API_KEY)


def provider_name() -> str:
    if settings.MATHPIX_APP_ID and settings.MATHPIX_APP_KEY:
        return "mathpix"
    if settings.GEMINI_API_KEY:
        return "gemini"
    if settings.OPENROUTER_API_KEY:
        return "openrouter"
    if settings.GROQ_API_KEY and settings.GROQ_VISION_MODEL:
        return "groq"
    return "mock"


async def _openai_style(
    url: str, api_key: str, model: str, data_url: str, prompt: str
) -> str:
    async with httpx.AsyncClient(timeout=settings.GROQ_TIMEOUT_SECONDS) as client:
        response = await client.post(
            url,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": model,
                "temperature": 0.0,
                "max_tokens": 1200,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    }
                ],
            },
        )
        response.raise_for_status()
        return (response.json()["choices"][0]["message"]["content"] or "").strip()


async def _gemini(image_bytes: bytes, mime_type: str, prompt: str) -> str:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_MODEL}:generateContent"
    )
    async with httpx.AsyncClient(timeout=settings.GROQ_TIMEOUT_SECONDS) as client:
        response = await client.post(
            url,
            headers={"x-goog-api-key": settings.GEMINI_API_KEY},
            json={
                "contents": [
                    {
                        "parts": [
                            {"text": prompt},
                            {
                                "inline_data": {
                                    "mime_type": _normalize_mime(mime_type),
                                    "data": base64.b64encode(image_bytes).decode("ascii"),
                                }
                            },
                        ]
                    }
                ],
                "generationConfig": {"temperature": 0.0, "maxOutputTokens": 3000},
            },
        )
        response.raise_for_status()
        candidates = response.json().get("candidates") or []
        if not candidates:
            return ""
        parts = candidates[0].get("content", {}).get("parts", [])
        return "".join(p.get("text", "") for p in parts).strip()


async def read_image(image_bytes: bytes, mime_type: str, prompt: str = PROMPT) -> str | None:
    """Returnerar avläst text, eller None om ingen provider kunde svara."""
    if not is_image(mime_type):
        return None

    data_url = f"data:{_normalize_mime(mime_type)};base64,{base64.b64encode(image_bytes).decode('ascii')}"

    if settings.GEMINI_API_KEY:
        try:
            text = await _gemini(image_bytes, mime_type, prompt)
            if text:
                return text
        except Exception:
            pass

    if settings.OPENROUTER_API_KEY:
        try:
            text = await _openai_style(
                "https://openrouter.ai/api/v1/chat/completions",
                settings.OPENROUTER_API_KEY,
                settings.OPENROUTER_VISION_MODEL,
                data_url,
                prompt,
            )
            if text:
                return text
        except Exception:
            pass

    if settings.GROQ_API_KEY and settings.GROQ_VISION_MODEL:
        try:
            text = await _openai_style(
                "https://api.groq.com/openai/v1/chat/completions",
                settings.GROQ_API_KEY,
                settings.GROQ_VISION_MODEL,
                data_url,
                prompt,
            )
            if text:
                return text
        except Exception:
            pass

    return None
