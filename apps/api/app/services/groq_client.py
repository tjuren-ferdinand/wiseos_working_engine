"""Delad Groq-klient för textgenerering.

Groq används tillfälligt istället för Claude. När budget finns byts providern
via AI_PROVIDER i .env. Bild-OCR hanteras av services/vision_ocr.py.
"""
from __future__ import annotations

import asyncio
import re

import httpx

from ..config import settings

CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"

# Gratisnivån på Groq har låga rate limits – strypning + retry hindrar att
# rättningen tyst faller tillbaka på mock-feedback vid 429.
_LIMITER = asyncio.Semaphore(2)
_MAX_ATTEMPTS = 5
_MAX_BACKOFF_SECONDS = 30.0


def groq_enabled() -> bool:
    return bool(settings.GROQ_API_KEY)


def _parse_duration(value: str | None) -> float:
    """Tolkar Groqs varaktigheter, t.ex. '435ms', '1m26.4s' eller '12'."""
    if not value:
        return 0.0
    raw = value.strip().lower()
    try:
        return float(raw)
    except ValueError:
        pass

    seconds = 0.0
    number = ""
    for match in re.finditer(r"([\d.]+)(ms|m|s|h)", raw):
        amount = float(match.group(1))
        unit = match.group(2)
        seconds += amount * {"ms": 0.001, "s": 1.0, "m": 60.0, "h": 3600.0}[unit]
        number = match.group(0)
    return seconds if number else 0.0


def _retry_delay(headers, attempt: int) -> float:
    delay = _parse_duration(headers.get("retry-after"))
    if delay <= 0:
        delay = max(
            _parse_duration(headers.get("x-ratelimit-reset-tokens")),
            _parse_duration(headers.get("x-ratelimit-reset-requests")),
        )
    if delay <= 0:
        delay = float(2 ** attempt)
    return min(delay + 0.5, _MAX_BACKOFF_SECONDS)


def _model_chain() -> list[str]:
    """Primärmodell först, därefter reservmodeller med egna dygnskvoter."""
    models = [settings.GROQ_MODEL]
    for name in settings.GROQ_FALLBACK_MODELS.split(","):
        name = name.strip()
        if name and name not in models:
            models.append(name)
    return models


async def _post_once(payload: dict) -> tuple[str | None, float]:
    """Returnerar (svar, väntetid). Svar är None när modellen är rate limitad."""
    async with _LIMITER:
        async with httpx.AsyncClient(timeout=settings.GROQ_TIMEOUT_SECONDS) as client:
            response = await client.post(
                CHAT_URL,
                headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                json=payload,
            )
        if response.status_code == 429:
            return None, _retry_delay(response.headers, 0)
        response.raise_for_status()
        return (response.json()["choices"][0]["message"]["content"] or "").strip(), 0.0


async def _post(payload: dict) -> str:
    models = _model_chain()
    wait_seconds = 0.0

    for attempt in range(_MAX_ATTEMPTS):
        for model in models:
            content, wait_seconds = await _post_once({**payload, "model": model})
            if content is not None:
                return content

        if attempt == _MAX_ATTEMPTS - 1:
            raise RuntimeError(
                "Groq: alla modeller är rate limitade (kontrollera dygnskvoten i Groq-konsolen)"
            )
        await asyncio.sleep(wait_seconds or 2.0)

    raise RuntimeError("Groq: inget svar")


async def complete_text(
    system_prompt: str,
    user_message: str,
    *,
    max_tokens: int = 400,
    temperature: float = 0.2,
    json_mode: bool = False,
) -> str:
    payload: dict = {
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    return await _post(payload)

