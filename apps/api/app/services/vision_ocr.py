"""Ren bild-till-text-OCR för facitdokument och /api/v1/ocr.

OBS: elevrättning använder INTE den här modulen. Den går bildförst via
services/gemini_vision.py, där samma multimodala anrop både transkriberar och
bedömer. Här finns bara enkel texturläsning för facit och OCR-endpointen.

Providers provas i ordning tills en svarar: Gemini, OpenRouter, OpenAI.
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
_DEFAULT_TIMEOUT_SECONDS = 30.0


def _normalize_mime(mime_type: str) -> str:
    mime = mime_type.split(";")[0].strip().lower()
    return "image/jpeg" if mime == "image/jpg" else mime


def is_image(mime_type: str) -> bool:
    return _normalize_mime(mime_type) in IMAGE_MIME_TYPES


def available() -> bool:
    return bool(settings.OPENAI_API_KEY or settings.GEMINI_API_KEY or settings.OPENROUTER_API_KEY)


def provider_name() -> str:
    if settings.MATHPIX_APP_ID and settings.MATHPIX_APP_KEY:
        return "mathpix"
    if settings.GEMINI_API_KEY:
        return "gemini"
    if settings.OPENROUTER_API_KEY:
        return "openrouter"
    if settings.OPENAI_API_KEY and settings.OPENAI_VISION_MODEL:
        return "openai"
    return "unavailable"


async def _openai_style(
    url: str,
    api_key: str,
    model: str,
    data_url: str,
    prompt: str,
    *,
    token_param: str = "max_tokens",
    timeout_seconds: float | None = None,
    include_temperature: bool = True,
) -> str:
    timeout = timeout_seconds or _DEFAULT_TIMEOUT_SECONDS
    body: dict = {
        "model": model,
        token_param: 1200,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
    }
    if include_temperature:
        body["temperature"] = 0.0
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            url,
            headers={"Authorization": f"Bearer {api_key}"},
            json=body,
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


async def read_image_structured(
    image_bytes: bytes,
    mime_type: str,
    prompt: str,
    response_schema: dict,
) -> str:
    """Läs en bild med provider-native JSON/schema när Gemini finns.

    Till skillnad från read_image() är detta kontraktet för maskinläsbar output.
    Fallback-providers får samma prompt men deras text måste valideras av
    anroparen; inga parsefel maskeras som bildkvalitetsfel här.
    """
    normalized_mime = _normalize_mime(mime_type)
    if normalized_mime not in IMAGE_MIME_TYPES and normalized_mime != "application/pdf":
        raise ValueError(f"Filtypen {mime_type} stöds inte")
    if settings.GEMINI_API_KEY:
        return await _gemini(
            image_bytes,
            mime_type,
            prompt,
            json_mode=True,
            response_schema=response_schema,
        )
    fallback = await read_image(image_bytes, mime_type, prompt)
    if not fallback:
        raise RuntimeError("Vision-providern returnerade ett tomt svar")
    return fallback


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

    if settings.OPENAI_API_KEY and settings.OPENAI_VISION_MODEL and normalized_mime != "application/pdf":
        try:
            return await _openai_style(
                "https://api.openai.com/v1/chat/completions",
                settings.OPENAI_API_KEY,
                settings.OPENAI_VISION_MODEL,
                data_url,
                prompt,
                token_param="max_completion_tokens",
                timeout_seconds=settings.OPENAI_TIMEOUT_SECONDS,
                # gpt-5.x accepterar bara default-temperaturen (1).
                include_temperature=False,
            )
        except Exception as e:
            errors.append(f"OpenAI Error: {str(e)}")

    if errors:
        raise RuntimeError(" | ".join(errors))

    raise RuntimeError("Ingen Vision AI-nyckel är konfigurerad i .env-filen.")
