"""Batch-rättningspipeline.

Tar emot ett facit, klassparametrar och en lista uppladdade elev-filer.
Kör per fil:

1. OCR (Mathpix om konfigurerat, annars deterministisk mock).
2. Per facit-uppgift:
   a. Wolfram-verifierar elevens text mot facit.final_answer.
   b. Härleder verdict + pointsBase från Wolfram-confidence.
   c. Detekterar vilka klassregler som matchar parametertexten.
   d. Genererar pedagogisk feedback (Claude om nyckel finns, annars mock).
3. Returnerar StudentResult med GradingStep[] i samma form som frontendens
   `lib/store.ts` förväntar.

Designprincip: ALDRIG kasta – fallbacks på varje nivå så att en demo aldrig
fastnar. Wolfram är "sanningskällan" för matematik; Claude är språk-lagret.
"""
from __future__ import annotations

import asyncio
import base64
import re
import uuid
from dataclasses import dataclass

from ..config import settings
from ..schemas import (
    AnswerKeyItem,
    BatchGradingStep,
    BatchStudentResult,
    WolframResult,
)
from . import vision_ocr
from .feedback import generate_feedback
from .ocr import process_image
from .wolfram import WolframVerifier


# ---------------------------------------------------------------------------
# Klassregler – samma regex/penalty-tabell som frontendens RULE_DEFS
# ---------------------------------------------------------------------------

RULE_DEFS: dict[str, dict] = {
    "unit_penalty": {
        "match": re.compile(r"enhet", re.IGNORECASE),
        "penalty": 0.25,
    },
    "sigfig_strict": {
        "match": re.compile(r"gällande siffror|sig\.?fig", re.IGNORECASE),
        "penalty": 0.0,
    },
}


def active_rules(params_text: str) -> list[str]:
    """Vilka regler matchas av kombinerad parametertext."""
    return [name for name, cfg in RULE_DEFS.items() if cfg["match"].search(params_text)]


# Heuristik: gäller elevens text en "ren" siffra utan enhet? Då flagga unit_penalty.
_UNIT_TOKEN_RE = re.compile(
    r"\b(?:m|s|kg|g|km|cm|mm|N|J|W|Pa|Hz|V|A|Ω|mol|K|°C|%|m/s|m/s2|m/s\^2)\b",
    re.IGNORECASE,
)


def _missing_unit(student_text: str, expected_answer: str) -> bool:
    """True om facit innehåller en SI-enhet men elevens text inte gör det."""
    if not _UNIT_TOKEN_RE.search(expected_answer or ""):
        return False  # Facit har ingen enhet → regeln gäller inte
    return not _UNIT_TOKEN_RE.search(student_text or "")


# ---------------------------------------------------------------------------
# Namn-extraktion från filnamn ("Anna_Andersson - prov.pdf" → "Anna Andersson")
# ---------------------------------------------------------------------------


def derive_student_name(filename: str) -> str:
    base = re.sub(r"\.[^.]+$", "", filename)
    # Split off trailing suffix (t.ex. "Anna_Andersson - prov"): behåll delen före första " - " eller " – "
    head = re.split(r"\s*[-–]\s*", base, maxsplit=1)[0]
    # "Anna_Andersson" → ["Anna", "Andersson"]
    parts = re.findall(r"[A-Za-zÅÄÖåäö]+", head)
    if not parts:
        return "Okänd elev"
    return " ".join(p.capitalize() for p in parts[:3])


# ---------------------------------------------------------------------------
# Wolfram → verdict-mapping
# ---------------------------------------------------------------------------


def _verdict_from_wolfram(w: WolframResult) -> tuple[str, float]:
    """Returnerar (verdict, pointsRatio) där pointsRatio är 0–1 av pointsMax.

    Korrekt: confidence>=0.85 OCH is_correct → 1.0
    Delvis korrekt: confidence>=0.55 eller (is_correct men osäker) → 0.5
    Felaktig: annars → 0.0
    """
    if w.is_correct and w.confidence >= 0.85:
        return "correct", 1.0
    if w.is_correct or w.confidence >= 0.55:
        return "partial", 0.5
    return "incorrect", 0.0


# ---------------------------------------------------------------------------
# Pipelinen
# ---------------------------------------------------------------------------


@dataclass
class UploadedFile:
    filename: str
    content: bytes
    content_type: str


async def _ocr_one(file: UploadedFile) -> str:
    """OCR-stub: kör Mathpix om konfigurerat, annars mock. Returnerar plaintext."""
    encoded = base64.b64encode(file.content).decode("ascii")
    src = f"data:{file.content_type or 'image/png'};base64,{encoded}"
    res = await process_image(src)
    return res.text or res.latex or ""


async def _grade_one_step(
    *,
    item: AnswerKeyItem,
    student_text: str,
    klass_params: str,
    test_params: str,
    verifier: WolframVerifier,
) -> BatchGradingStep:
    # 1. Wolfram-verifiering
    try:
        wolfram = await verifier.verify_equation(student_text, item.final_answer)
    except Exception as e:  # noqa: BLE001
        wolfram = WolframResult(is_correct=False, confidence=0.0, notes=f"wolfram-error: {e!s}")

    verdict, ratio = _verdict_from_wolfram(wolfram)
    points_max = float(max(1, len(item.derivation_steps) or 1))
    points_base = round(points_max * ratio, 2)

    # 2. Detektera klassregler
    applied: list[str] = []
    combined_params = f"{klass_params}\n{test_params}"
    if "unit_penalty" in active_rules(combined_params) and _missing_unit(
        student_text, item.final_answer
    ):
        applied.append("unit_penalty")

    # 3. Pedagogisk feedback (Claude om konfigurerat, annars mock)
    try:
        feedback = await generate_feedback(
            problem=f"Uppgift {item.question_number}",
            student_answer=student_text or "(ingen text extraherad)",
            correct_answer=item.final_answer,
            wolfram=wolfram,
        )
    except Exception:
        feedback = (
            f"Wolfram-verifiering: {'korrekt' if wolfram.is_correct else 'avviker'} "
            f"(konfidens {wolfram.confidence:.0%}). {wolfram.notes or ''}"
        )

    label = f"Uppgift {item.question_number} · Slutsvar"
    return BatchGradingStep(
        id=str(uuid.uuid4()),
        label=label,
        studentWork=(student_text or "(ingen text extraherad)").strip()[:400],
        baseAnnotation=feedback.strip(),
        appliedRules=applied,
        aiVerdict=verdict,
        pointsMax=points_max,
        pointsBase=points_base,
        pointsTeacher=None,
        status="ai_suggested",
        confidence=round(float(wolfram.confidence), 3),
        wolframNotes=wolfram.notes,
    )


async def grade_batch(
    *,
    prov_id: str,
    answer_key: list[AnswerKeyItem],
    class_grading_parameters: str,
    test_specific_parameters: str,
    files: list[UploadedFile],
) -> list[BatchStudentResult]:
    """Kör hela pipelinen för en uppsättning elever (en fil per elev)."""
    verifier = WolframVerifier()
    semaphore = asyncio.Semaphore(2)

    async def _process_one(upload: UploadedFile) -> BatchStudentResult:
        async with semaphore:
            student_name = derive_student_name(upload.filename)
            try:
                student_text = await _ocr_one(upload)
            except Exception:
                student_text = ""

            # Kör Wolfram + AI parallellt över alla facit-items för denna elev
            step_tasks = [
                _grade_one_step(
                    item=item,
                    student_text=student_text,
                    klass_params=class_grading_parameters,
                    test_params=test_specific_parameters,
                    verifier=verifier,
                )
                for item in answer_key
            ]
            steps = await asyncio.gather(*step_tasks, return_exceptions=True)
            resolved_steps: list[BatchGradingStep] = []
            for st in steps:
                if isinstance(st, Exception):
                    resolved_steps.append(
                        BatchGradingStep(
                            id=str(uuid.uuid4()),
                            label="Uppgift ? · Fel",
                            studentWork="",
                            baseAnnotation=f"Fel i rättningssteget: {st!s}",
                            appliedRules=[],
                            aiVerdict="incorrect",
                            pointsMax=1.0,
                            pointsBase=0.0,
                            pointsTeacher=None,
                            status="ai_suggested",
                            confidence=0.0,
                            wolframNotes=None,
                        )
                    )
                else:
                    resolved_steps.append(st)

            return BatchStudentResult(
                id=str(uuid.uuid4()),
                provId=prov_id,
                studentName=student_name,
                scanPages=[],  # frontend lägger på data-URLs
                steps=resolved_steps,
            )

    results = await asyncio.gather(*[_process_one(u) for u in files])
    return list(results)


def integration_status() -> dict[str, bool | str]:
    provider = settings.AI_PROVIDER.strip().lower()
    mathpix = bool(settings.MATHPIX_APP_ID and settings.MATHPIX_APP_KEY)
    ocr_provider = vision_ocr.provider_name()
    return {
        "wolfram": bool(settings.WOLFRAM_APP_ID or settings.WOLFRAM_API_URL),
        "groq": provider == "groq" and bool(settings.GROQ_API_KEY),
        "anthropic": provider == "anthropic" and bool(settings.ANTHROPIC_API_KEY),
        "mathpix": mathpix,
        # OCR körs live via Mathpix eller en gratis vision-provider som tillfällig ersättare.
        "ocr": ocr_provider != "mock",
        "ocrProvider": ocr_provider,
    }
