"""Pedagogisk feedback-generator (Claude med mock-fallback)."""
from __future__ import annotations

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


async def generate_feedback(
    problem: str,
    student_answer: str,
    correct_answer: str,
    wolfram: WolframResult,
) -> str:
    if not settings.ANTHROPIC_API_KEY:
        return _mock_feedback(problem, student_answer, correct_answer, wolfram)

    # GDPR: skrubba PII (personnummer, e-post, telefon) innan vi skickar till Claude.
    safe_problem = scrub_pii(problem)
    safe_student = scrub_pii(student_answer)
    safe_correct = scrub_pii(correct_answer)

    try:
        # Lat import så servern startar även utan paket
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        user_msg = (
            f"Uppgift: {safe_problem}\n"
            f"Korrekt svar: {safe_correct}\n"
            f"Elevens svar: {safe_student}\n"
            f"Wolfram-verifiering: korrekt={wolfram.is_correct}, konfidens={wolfram.confidence}\n"
            f"Anteckningar: {wolfram.notes or '-'}"
        )
        msg = await client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=400,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )
        parts = [b.text for b in msg.content if getattr(b, "type", None) == "text"]
        return "\n".join(parts).strip() or _mock_feedback(problem, student_answer, correct_answer, wolfram)
    except Exception:
        return _mock_feedback(problem, student_answer, correct_answer, wolfram)
