"""Pedagogisk feedback-generator (Claude med mock-fallback)."""
from __future__ import annotations

import httpx

from ..config import settings
from ..schemas import WolframResult
from .anonymize import scrub_pii


SYSTEM_PROMPT = (
    "Du är en erfaren mattelärare som ger konstruktiv feedback på elevarbete. "
    "Givet uppgiften, korrekta svaret, elevens svar och Wolfram-verifiering: "
    "1) Identifiera tydligt var eleven gjorde fel (om fel). "
    "2) Förklara rätt tillvägagångssätt enkelt. "
    "3) Beröm specifika korrekta steg. "
    "4) Föreslå en liknande övningsuppgift. "
    "Maxlängd 150 ord. Skriv på svenska, varmt och uppmuntrande."
)


def _mock_feedback(problem: str, student: str, correct: str, w: WolframResult) -> str:
    if w.is_correct:
        return (
            f"Snyggt jobbat! Ditt svar **{student}** stämmer. "
            f"Du har visat att du behärskar metoden. "
            f"Försök gärna en liknande uppgift för att befästa kunskapen."
        )
    return (
        f"Inte riktigt rätt – du svarade **{student}** men korrekt svar är **{correct}**. "
        f"Gå tillbaka och kontrollera varje steg, särskilt teckenhantering och förenklingar. "
        f"Tips: skriv om uppgiften steg för steg och verifiera varje led. "
        f"Du är på god väg – fortsätt öva!"
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


async def generate_feedback(
    problem: str,
    student_answer: str,
    correct_answer: str,
    wolfram: WolframResult,
) -> str:
    safe_problem = scrub_pii(problem)
    safe_student = scrub_pii(student_answer)
    safe_correct = scrub_pii(correct_answer)
    user_msg = _feedback_message(safe_problem, safe_student, safe_correct, wolfram)
    provider = settings.AI_PROVIDER.strip().lower()

    try:
        if provider == "groq" and settings.GROQ_API_KEY:
            return await _generate_with_groq(user_msg) or _mock_feedback(problem, student_answer, correct_answer, wolfram)
        if provider == "anthropic" and settings.ANTHROPIC_API_KEY:
            return await _generate_with_anthropic(user_msg) or _mock_feedback(problem, student_answer, correct_answer, wolfram)
    except (httpx.HTTPError, KeyError, IndexError, TypeError):
        pass
    except Exception:
        pass

    return _mock_feedback(problem, student_answer, correct_answer, wolfram)
