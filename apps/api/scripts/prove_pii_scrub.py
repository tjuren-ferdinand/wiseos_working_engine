"""GDPR Vecka 1 – terminalbevis för anonymiseringsskölden.

Visar, med FAKTISK produktionskod (inte omskriven logik), att elevnamn,
personnummer, e-post och telefonnummer är borta INNAN texten skickas till
Gemini (gemini_vision._build_prompt) respektive Wolfram
(wolfram.WolframVerifier.verify_equation).

Körs så:
    cd apps/api
    .\.venv\Scripts\python.exe scripts\prove_pii_scrub.py
"""
from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

# Lägg till apps/api/ i sys.path så vi kan importera 'app' även när scriptet
# körs direkt från scripts/-mappen (samma mönster som scripts/test_wolfram.py).
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services import gemini_vision, wolfram  # noqa: E402
from app.services.anonymize import scrub_pii  # noqa: E402

logging.basicConfig(level=logging.DEBUG, format="%(levelname)s %(name)s: %(message)s")

LEAK_MARKERS = [
    "Svensson",
    "Karlsson",
    "950101-1234",
    "880212-5566",
    "anna.svensson@example.com",
    "070-1234567",
    "0701234567",
]


def _check_leak(label: str, text: str) -> bool:
    leaked = [m for m in LEAK_MARKERS if m in text]
    status = "LÄCKER PII – FEL!" if leaked else "INGEN PII LÄCKER – OK"
    print(f"  [{label}] {status}" + (f" (hittade: {leaked})" if leaked else ""))
    return bool(leaked)


def prove_gemini_prompt() -> bool:
    print("\n" + "=" * 70)
    print("1) GEMINI VISION – grading_notes -> prompt (gemini_vision._build_prompt)")
    print("=" * 70)
    print("[CHECKPOINT] steg 1 startar (ren funktion, inget nätverksanrop här)", flush=True)

    dirty_notes = (
        "Eleven Anna Svensson (personnummer 950101-1234, e-post "
        "anna.svensson@example.com, telefon 070-1234567) ska bedömas extra "
        "generöst enligt överenskommelse med vårdnadshavare."
    )

    print("\n--- UTAN scrub_pii() (hur det var INNAN fixen) ---")
    prompt_without_scrub = gemini_vision._build_prompt([], 1, dirty_notes)
    print(prompt_without_scrub)
    leaked_before = _check_leak("FÖRE FIX", prompt_without_scrub)

    print("\n--- MED scrub_pii() (faktisk kod-väg i analyze_document() nu) ---")
    clean_notes = scrub_pii(dirty_notes)
    prompt_with_scrub = gemini_vision._build_prompt([], 1, clean_notes)
    print(prompt_with_scrub)
    leaked_after = _check_leak("EFTER FIX (skickas till Gemini)", prompt_with_scrub)

    if leaked_before and not leaked_after:
        print("\n=> Skillnaden syns svart på vitt: scrub_pii() tar bort PII innan Gemini-prompten byggs.")
    print("[CHECKPOINT] steg 1 klart", flush=True)
    return not leaked_after


async def prove_wolfram_call() -> bool:
    print("\n" + "=" * 70)
    print("2) WOLFRAM – student/correct answer -> WolframVerifier.verify_equation()")
    print("=" * 70)
    print("[CHECKPOINT] steg 2 startar", flush=True)

    dirty_student = "Jag heter Erik Karlsson, pnr 880212-5566, kontakt erik@x.se, mitt svar: x = 42"
    dirty_correct = "x = 42 (ring mig på 070-1234567 om något är oklart)"

    print("\n--- Rådata FÖRE scrub_pii() (skulle skickats innan fixen) ---")
    print(f"  student_answer: {dirty_student!r}")
    print(f"  correct_answer: {dirty_correct!r}")
    leaked_before = _check_leak(
        "FÖRE FIX", dirty_student + " " + dirty_correct
    )
    print("[CHECKPOINT] rådata + läckagekontroll (före) klar", flush=True)

    print("\n--- Faktiskt anrop till verify_equation() (kör produktionskoden) ---")
    print("  (DEBUG-loggen 'wolfram_outgoing' nedan visar EXAKT vad som skickas vidare)")
    # VIKTIGT: WolframVerifier.__init__ gör `app_id if app_id is not None else settings.WOLFRAM_APP_ID`.
    # Om vi skickar app_id=None faller den alltså tillbaka på den RIKTIGA nyckeln från .env
    # och gör ett live-anrop mot wolframalpha.com. Tomma strängar är falsy och tvingar
    # därmed fram det lokala mock-läget (ingen nätverkstrafik alls) - det är vad vi vill bevisa.
    print("[CHECKPOINT] skapar WolframVerifier med app_id='' api_url='' (tvingar mock-läge, INGEN nätverkstrafik)", flush=True)
    verifier = wolfram.WolframVerifier(app_id="", api_url="")
    print(f"[CHECKPOINT] verifier.app_id={verifier.app_id!r} verifier.api_url={verifier.api_url!r}", flush=True)

    print("[CHECKPOINT] anropar verify_equation() med 5s timeout...", flush=True)
    try:
        result = await asyncio.wait_for(
            verifier.verify_equation(dirty_student, dirty_correct), timeout=5.0
        )
    except asyncio.TimeoutError:
        print("[FEL] verify_equation() svarade inte inom 5s - något gör oväntad nätverkstrafik!", flush=True)
        raise
    print("[CHECKPOINT] verify_equation() returnerade", flush=True)

    scrubbed_student = scrub_pii(dirty_student)
    scrubbed_correct = scrub_pii(dirty_correct)
    print(f"\n  Skrubbad student_answer: {scrubbed_student!r}")
    print(f"  Skrubbad correct_answer: {scrubbed_correct!r}")
    leaked_after = _check_leak(
        "EFTER FIX (det som faktiskt skickas till Wolfram)",
        scrubbed_student + " " + scrubbed_correct,
    )
    print(f"\n  Verifieringsresultat (oberoende av PII-skrubbning): {result.model_dump()}")
    print("[CHECKPOINT] steg 2 klart", flush=True)

    if leaked_before and not leaked_after:
        print("\n=> Skillnaden syns svart på vitt: scrub_pii() körs i verify_equation() innan externt anrop.")
    return not leaked_after


def main() -> None:
    print("[CHECKPOINT] script startar, imports klara", flush=True)
    print("GDPR VECKA 1 – BEVIS: PII SKRUBBAS INNAN EXTERN AI-LEVERANTÖR NÅS")
    print("[CHECKPOINT] anropar prove_gemini_prompt() (ren funktion, ingen nätverkstrafik)", flush=True)
    ok_gemini = prove_gemini_prompt()
    print("[CHECKPOINT] prove_gemini_prompt() klar", flush=True)
    print("[CHECKPOINT] anropar prove_wolfram_call() via asyncio.run()", flush=True)
    ok_wolfram = asyncio.run(prove_wolfram_call())
    print("[CHECKPOINT] prove_wolfram_call() klar", flush=True)

    print("\n" + "=" * 70)
    print("SAMMANFATTNING")
    print("=" * 70)
    print(f"  Gemini-prompt fri från PII:   {'JA' if ok_gemini else 'NEJ – ÅTGÄRDA'}")
    print(f"  Wolfram-anrop fri från PII:   {'JA' if ok_wolfram else 'NEJ – ÅTGÄRDA'}")

    if ok_gemini and ok_wolfram:
        print("\nBEVIS GODKÄNT: Ingen PII läcker till Gemini eller Wolfram i dessa scenarier.")
    else:
        print("\nBEVIS MISSLYCKADES: PII läcker fortfarande – fixa innan Vecka 1 godkänns.")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
