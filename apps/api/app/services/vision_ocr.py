"""Ren bild-till-text-OCR för facitdokument och /api/v1/ocr.

OBS: elevrättning använder INTE den här modulen. Den går bildförst via
services/gemini_vision.py, där samma multimodala anrop både transkriberar och
bedömer. Här finns bara enkel texturläsning för facit och OCR-endpointen.

Providers provas i ordning tills en svarar: Gemini, OpenRouter, Groq.
"""
from __future__ import annotations

import base64
import re

import httpx

from ..config import settings

PROMPT = (
    "Du är en OCR-motor för handskrivna prov i matematik och fysik. "
    "Läs av allt som eleven har skrivit på bilden, exakt som det står. "
    "Behåll uppgiftsnummer, mellanled, enheter och slutsvar. "
    "Svara enbart med den avlästa texten, utan kommentarer."
)

IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"}

_GEMINI_TIMEOUT_SECONDS = 120.0


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
    return "unavailable"


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


def _clean_text(text: str) -> str:
    text = re.sub(r"<thinking>.*?</thinking>", "", text, flags=re.DOTALL)
    text = re.sub(r"\bthinking\b.*?(?=\b[^\s])", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = text.replace("```json", "").replace("```", "")
    return text.strip()


async def _gemini(
    image_bytes: bytes,
    mime_type: str,
    prompt: str,
    *,
    system_instruction: str = "",
    json_mode: bool = False,
    response_schema: dict | None = None,
) -> str:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_MODEL}:generateContent"
    )

    generation_config: dict = {
        "temperature": 0.0,
        "maxOutputTokens": 3000,
    }
    if json_mode:
        generation_config["responseMimeType"] = "application/json"
    if response_schema and json_mode:
        generation_config["responseSchema"] = response_schema

    contents: list[dict] = []
    if system_instruction:
        contents.append({"role": "user", "parts": [{"text": system_instruction}]})
    contents.append({
        "role": "user",
        "parts": [
            {"text": prompt},
            {
                "inline_data": {
                    "mime_type": _normalize_mime(mime_type),
                    "data": base64.b64encode(image_bytes).decode("ascii"),
                }
            },
        ],
    })

    async with httpx.AsyncClient(timeout=_GEMINI_TIMEOUT_SECONDS) as client:
        response = await client.post(
            url,
            headers={"x-goog-api-key": settings.GEMINI_API_KEY},
            json={
                "contents": contents,
                "generationConfig": generation_config,
            },
        )
        response.raise_for_status()
        candidates = response.json().get("candidates") or []
        if not candidates:
            return ""
        parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(p.get("text", "") for p in parts).strip()
        return _clean_text(text)


async def read_image(image_bytes: bytes, mime_type: str, prompt: str = PROMPT) -> str | None:
    normalized_mime = _normalize_mime(mime_type)
    if normalized_mime not in IMAGE_MIME_TYPES and normalized_mime != "application/pdf":
        return None

    data_url = f"data:{normalized_mime};base64,{base64.b64encode(image_bytes).decode('ascii')}"
    errors = []

    if settings.GEMINI_API_KEY:
        try:
            return await _gemini(image_bytes, mime_type, prompt)
        except Exception as e:
            errors.append(f"Gemini Error: {str(e)}")

    if settings.OPENROUTER_API_KEY and normalized_mime != "application/pdf":
        try:
            return await _openai_style("https://openrouter.ai/api/v1/chat/completions", settings.OPENROUTER_API_KEY, settings.OPENROUTER_VISION_MODEL, data_url, prompt)
        except Exception as e:
            errors.append(f"OpenRouter Error: {str(e)}")

    if settings.GROQ_API_KEY and settings.GROQ_VISION_MODEL and normalized_mime != "application/pdf":
        try:
            return await _openai_style("https://api.groq.com/openai/v1/chat/completions", settings.GROQ_API_KEY, settings.GROQ_VISION_MODEL, data_url, prompt)
        except Exception as e:
            errors.append(f"Groq Error: {str(e)}")

    if errors:
        raise RuntimeError(" | ".join(errors))

    raise RuntimeError("Ingen Vision AI-nyckel är konfigurerad i .env-filen.")
