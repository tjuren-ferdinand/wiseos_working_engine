"""Gemini textgenerering – tillfällig provider tills Claude aktiveras.

Speglar groq_client.complete_text() signaturmässigt så att feedback.py och
routers/claude.py kan byta provider utan att ändra anropskod. När
ANTHROPIC_API_KEY sätts och AI_PROVIDER=anthropic tar Claude över samma roll.
"""
from __future__ import annotations

import asyncio
import json

import httpx

from ..config import settings

GENERATE_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)

# Gemini free-tier ger ibland transienta 503 (overloaded) / timeouts.
# Denna modell använder "thinking" (dolda resonemangstoken) innan svaret
# skrivs ut, vilket kan ta 20-40 s för en enkel feedback-prompt. Timeouten
# måste vara generös nog för det, samtidigt som vi begränsar antal retries.
_MAX_ATTEMPTS = 2
_RETRY_STATUS = {429, 500, 502, 503, 504}
_GEMINI_TIMEOUT_SECONDS = 60.0


def gemini_enabled() -> bool:
    return bool(settings.GEMINI_API_KEY)


async def complete_text(
    system_prompt: str,
    user_message: str,
    *,
    max_tokens: int = 1200,
    temperature: float = 0.2,
    json_mode: bool = False,
) -> str:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY är inte konfigurerad")

    url = GENERATE_URL.format(model=settings.GEMINI_MODEL)
    generation_config: dict = {
        "temperature": temperature,
        "maxOutputTokens": max_tokens,
    }
    if json_mode:
        generation_config["responseMimeType"] = "application/json"

    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_message}]}],
        "generationConfig": generation_config,
    }

    last_error: Exception | None = None
    for attempt in range(_MAX_ATTEMPTS):
        try:
            async with httpx.AsyncClient(timeout=_GEMINI_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    url,
                    headers={"x-goog-api-key": settings.GEMINI_API_KEY, "Content-Type": "application/json"},
                    json=payload,
                )
            if response.status_code in _RETRY_STATUS and attempt < _MAX_ATTEMPTS - 1:
                await asyncio.sleep(1.5 * (attempt + 1))
                continue
            response.raise_for_status()
            data = response.json()
            break
        except (httpx.TimeoutException, httpx.TransportError) as e:
            last_error = e
            if attempt < _MAX_ATTEMPTS - 1:
                await asyncio.sleep(1.5 * (attempt + 1))
                continue
            raise
    else:
        raise last_error or RuntimeError("Gemini: alla försök misslyckades")

    candidates = data.get("candidates") or []
    if not candidates:
        block_reason = data.get("promptFeedback", {}).get("blockReason")
        raise RuntimeError(f"Gemini gav inget svar (blockReason={block_reason})")

    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        raise RuntimeError("Gemini gav ett tomt svar")
    return text


async def complete_json(
    system_prompt: str,
    user_message: str,
    *,
    max_tokens: int = 800,
    temperature: float = 0.2,
) -> dict:
    text = await complete_text(
        system_prompt, user_message, max_tokens=max_tokens, temperature=temperature, json_mode=True
    )
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise
