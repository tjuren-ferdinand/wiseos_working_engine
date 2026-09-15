"""Delad OpenAI-klient för text- och visionsgenerering.

Ersätter Groq fullständigt. Modellerna delas per roll:
OPENAI_FEEDBACK_MODEL för textvolym (feedback, facitgenerering) och
OPENAI_MODEL för vision/bedömning. Reservmodeller via
OPENAI_FALLBACK_MODELS används när primärmodellen är rate limitad.
"""
from __future__ import annotations

import asyncio
import re

import httpx

from ..config import settings

CHAT_URL = "https://api.openai.com/v1/chat/completions"

# Strypning + retry hindrar att rättningen tyst faller tillbaka på
# mock-feedback vid 429.
_LIMITER = asyncio.Semaphore(4)
_MAX_ATTEMPTS = 5
_MAX_BACKOFF_SECONDS = 30.0


def openai_enabled() -> bool:
    return bool(settings.OPENAI_API_KEY)


def _parse_duration(value: str | None) -> float:
    """Tolkar OpenAI:s varaktigheter, t.ex. '435ms', '1m26.4s' eller '12'."""
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
        delay = _parse_duration(headers.get("retry-after-ms")) / 1000.0
    if delay <= 0:
        delay = max(
            _parse_duration(headers.get("x-ratelimit-reset-tokens")),
            _parse_duration(headers.get("x-ratelimit-reset-requests")),
        )
    if delay <= 0:
        delay = float(2 ** attempt)
    return min(delay + 0.5, _MAX_BACKOFF_SECONDS)


def _text_model_chain() -> list[str]:
    """Primär textmodell först, därefter reservmodeller med egna kvoter."""
    models = [settings.OPENAI_FEEDBACK_MODEL]
    for name in settings.OPENAI_FALLBACK_MODELS.split(","):
        name = name.strip()
        if name and name not in models:
            models.append(name)
    return models


def vision_model() -> str:
    return settings.OPENAI_MODEL


async def _post_once(payload: dict) -> tuple[str | None, float]:
    """Returnerar (svar, väntetid). Svar är None när modellen är rate limitad."""
    async with _LIMITER:
        async with httpx.AsyncClient(timeout=settings.OPENAI_TIMEOUT_SECONDS) as client:
            response = await client.post(
                CHAT_URL,
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                json=payload,
            )
        if response.status_code == 429:
            return None, _retry_delay(response.headers, 0)
        response.raise_for_status()
        return (response.json()["choices"][0]["message"]["content"] or "").strip(), 0.0


async def chat_completion(payload: dict, models: list[str]) -> str:
    """Kör chat completions mot första tillgängliga modellen i kedjan."""
    wait_seconds = 0.0

    for attempt in range(_MAX_ATTEMPTS):
        for model in models:
            content, wait_seconds = await _post_once({**payload, "model": model})
            if content is not None:
                return content

        if attempt == _MAX_ATTEMPTS - 1:
            raise RuntimeError(
                "OpenAI: alla modeller är rate limitade (kontrollera kvoten i OpenAI-konsolen)"
            )
        await asyncio.sleep(wait_seconds or 2.0)

    raise RuntimeError("OpenAI: inget svar")


async def complete_text(
    system_prompt: str,
    user_message: str,
    *,
    max_tokens: int = 400,
    temperature: float = 0.2,
    json_mode: bool = False,
) -> str:
    payload: dict = {
        # gpt-5.x accepterar bara default-temperaturen (1) — parametern utelämnas.
        # gpt-5.x kräver max_completion_tokens — max_tokens är borttaget.
        "max_completion_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    return await chat_completion(payload, _text_model_chain())
