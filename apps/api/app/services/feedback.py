"""Pedagogisk feedback-generator (Claude med mock-fallback)."""
from __future__ import annotations

import logging
import re

from ..config import settings
from ..schemas import WolframResult
from . import gemini_client
from .anonymize import scrub_pii

logger = logging.getLogger(__name__)


def _safe_output(text: str) -> str:
    text = re.sub(r"<(?:think|thinking)>.*?</(?:think|thinking)>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"```(?:json)?|```", "", text, flags=re.IGNORECASE)
    return text.strip()[:2000]


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


async def _generate_with_anthropic(user_msg: str) -> str:
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    msg = await client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=400,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )
    return _safe_output("\n".join(b.text for b in msg.content if getattr(b, "type", None) == "text"))


def provider_name() -> str:
    configured = settings.FEEDBACK_PROVIDER.strip().lower()
    if configured != "auto":
        return configured
    if settings.ANTHROPIC_API_KEY:
        return "anthropic"
    if settings.OPENAI_API_KEY:
        return "openai"
    if settings.GEMINI_API_KEY:
        return "gemini"
    return "unavailable"


async def generate_feedback_detailed(
    problem: str,
    student_answer: str,
    correct_answer: str,
    wolfram: WolframResult,
) -> tuple[str, str]:
    """Delegates to the active feedback provider via the registry."""
    from .providers.registry import get_feedback_provider

    safe_problem = scrub_pii(problem)
    safe_student = scrub_pii(student_answer)
    safe_correct = scrub_pii(correct_answer)

    provider = get_feedback_provider()
    text, used = await provider.generate_feedback(
        problem=safe_problem,
        student_answer=safe_student,
        correct_answer=safe_correct,
        wolfram=wolfram,
    )
    if not text:
        raise RuntimeError(f"Feedback-provider {used} returnerade ett tomt svar")
    return text, used


async def generate_feedback(
    problem: str,
    student_answer: str,
    correct_answer: str,
    wolfram: WolframResult,
) -> str:
    text, _provider_used = await generate_feedback_detailed(problem, student_answer, correct_answer, wolfram)
    return text
