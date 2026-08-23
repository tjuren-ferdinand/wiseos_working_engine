"""Pedagogisk feedback-generator (Claude med mock-fallback)."""
from __future__ import annotations

import logging

import httpx

from ..config import settings
from ..schemas import WolframResult
from . import gemini_client
from .anonymize import scrub_pii

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = (
    "Du är en erfaren mattelärare som ger konstruktiv feedback på elevarbete. "
    "Givet uppgiften, korrekta svaret, elevens svar och Wolfram-verifiering: "
    "1) Identifiera tydligt var eleven gjorde fel (om fel). "
    "2) Förklara rätt tillvägagångssätt enkelt. "
    "3) Beröm specifika korrekta steg. "
    "4) Föreslå en liknande övningsuppgift. "
    "Maxlängd 150 ord. Skriv på svenska, varmt och uppmuntrande."
)


def _feedback_message(problem: str, student: str, correct: str, wolfram: WolframResult) -> str:
    return (
        f"Uppgift: {problem}\n"
        f"Korrekt svar: {correct}\n"
        f"Elevens svar: {student}\n"
        f"Wolfram-verifiering: korrekt={wolfram.is_correct}, konfidens={wolfram.confidence}\n"
        f"Anteckningar: {wolfram.notes or '-'}"
    )


async def _generate_with_groq(user_msg: str) -> str:
    async with httpx.AsyncClient(timeout=settings.GROQ_TIMEOUT_SECONDS) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
            json={
                "model": settings.GROQ_MODEL,
                "temperature": 0.2,
                "max_tokens": 400,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
            },
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return content.strip()


async def _generate_with_anthropic(user_msg: str) -> str:
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    msg = await client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=400,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )
    return "\n".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()


async def generate_feedback_detailed(
    problem: str,
    student_answer: str,
    correct_answer: str,
    wolfram: WolframResult,
) -> tuple[str, str]:
    safe_problem = scrub_pii(problem)
    safe_student = scrub_pii(student_answer)
    safe_correct = scrub_pii(correct_answer)
    user_msg = _feedback_message(safe_problem, safe_student, safe_correct, wolfram)
    provider = settings.AI_PROVIDER.strip().lower()

    try:
        if provider == "groq" and settings.GROQ_API_KEY:
            text = await _generate_with_groq(user_msg)
            if text:
                return text, "groq"
        elif provider == "gemini" and settings.GEMINI_API_KEY:
            text = await gemini_client.complete_text(SYSTEM_PROMPT, user_msg, max_tokens=1200)
            if text:
                return text, "gemini"
        elif provider == "anthropic" and settings.ANTHROPIC_API_KEY:
            text = await _generate_with_anthropic(user_msg)
            if text:
                return text, "anthropic"
    except Exception as e:
        logger.exception("AI-provider %r misslyckades", provider)
        raise RuntimeError(f"Kunde inte generera AI-feedback. Provider ({provider}) returnerade ett fel: {str(e)}") from e

    raise RuntimeError("Ingen AI-provider för feedback är konfigurerad eller aktiverad.")


async def generate_feedback(
    problem: str,
    student_answer: str,
    correct_answer: str,
    wolfram: WolframResult,
) -> str:
    text, _provider_used = await generate_feedback_detailed(problem, student_answer, correct_answer, wolfram)
    return text
