"""Om-rättning av sparade elevresultat.

Kör vision-pipelinen om på ett resultats lagrade scanPages mot provets
sparade facit (`answer_keys.items`) — samma kedja som batch-rättningen
(analyze_document → matematisk verifiering → feedback) utan ny uppladdning.

Elevspecifika AI-premisser (`GradingResult.custom_instructions`) läggs till
i grading_notes sist, efter klass- och provparametrar.

Samma princip som pipelinen: providerfel yter som needs_review-steg med
felorsak i klartext — aldrig ett kastat 500 och aldrig påhittade data.
"""
from __future__ import annotations

import asyncio
import base64
import logging
from datetime import datetime

from .. import models, schemas
from . import gemini_vision
from .batch_pipeline import (
    apply_feedback_provider,
    apply_math_verification,
    build_grading_steps,
)
from .gemini_vision import GradingError
from .providers.registry import get_vision_provider

logger = logging.getLogger("wiseos.grading")

MAX_INSTRUCTIONS_CHARS = 2000
_MAX_CONCURRENT_REGRADE = 3


class RegradeUnavailable(RuntimeError):
    """Resultatet kan inte rättas om (saknar sidor, är inte elevinlämning)."""


def _decode_scan_pages(scan_pages: list) -> list[tuple[bytes, str]]:
    """Data-URL -> (bytes, mime). Hoppar över trasiga eller osupportade sidor."""
    pages: list[tuple[bytes, str]] = []
    for url in scan_pages or []:
        if not isinstance(url, str) or ";base64," not in url:
            continue
        header, encoded = url.split(";base64,", 1)
        mime = header.removeprefix("data:")
        if not gemini_vision.is_supported_document(mime):
            continue
        try:
            pages.append((base64.b64decode(encoded), mime))
        except Exception:
            logger.warning("regrade_scan_page_decode_failed")
    return pages


def _class_params_text(test: models.Test) -> str:
    """Återskapar samma regeltext som frontendens klassParams-serialisering."""
    gp = (test.klass.grading_params or {}) if test.klass else {}
    parts = [
        ". ".join(gp.get("customRules") or []),
        "Kräv gällande siffror." if gp.get("significantFigures") else "",
        "Kräv enheter i slutsvar." if (gp.get("unitErrorPenalty") or 0) > 0 else "",
    ]
    return " ".join(p for p in parts if p)


def _answer_key_items(test: models.Test) -> list[schemas.AnswerKeyItem]:
    if not test.answer_key or not test.answer_key.items:
        return []
    return [
        schemas.AnswerKeyItem.model_validate(item)
        for item in test.answer_key.items
    ]


def _grading_notes(test: models.Test, row: models.GradingResult) -> str:
    return "\n".join(
        part.strip()
        for part in (
            _class_params_text(test),
            test.custom_params or "",
            row.custom_instructions or "",
        )
        if part and part.strip()
    )


def _apply_row(row: models.GradingResult, questions, meta) -> None:
    steps = build_grading_steps(row.id, questions)
    row.steps = steps
    row.total_score = round(sum(s["earnedPoints"] for s in steps), 2)
    row.max_score = round(sum(s["maxPoints"] for s in steps), 2)
    row.percentage = (
        round(row.total_score / row.max_score * 100, 2) if row.max_score else 0.0
    )
    row.document = meta.model_dump(mode="json") if hasattr(meta, "model_dump") else meta
    row.graded_at = datetime.utcnow()


async def regrade_result_row(row: models.GradingResult) -> models.GradingResult:
    """Kör om rättningen för en sparad rad. Row måste ha test+klass+answer_key laddade.

    reviewed/teacherNote/ai*-fält nollställs via nya steg — ny bedömning
    kräver ny granskning.
    """
    test = row.test
    if (row.document or {}).get("documentType") == "not_student_submission":
        raise RegradeUnavailable("Resultatet är inte en elevinlämning.")
    pages = _decode_scan_pages(row.scan_pages)
    if not pages:
        raise RegradeUnavailable("Inga läsbara sidor lagrade för detta resultat.")

    answer_key = _answer_key_items(test)
    answer_key_source = (
        test.answer_key.source if test.answer_key else "none"
    )

    try:
        questions, meta = await get_vision_provider().analyze_document(
            pages=pages,
            answer_key=answer_key,
            grading_notes=_grading_notes(test, row),
            student_label=row.student_name,
        )
    except GradingError as e:
        # Samma kontrakt som batchen: providerfel -> needs_review, aldrig 500.
        meta = schemas.DocumentMeta(
            pageCount=len(pages),
            model=get_vision_provider().name,
            questionsExpected=len(answer_key),
            error=str(e),
            needsReviewCount=len(answer_key) or 1,
        )
        questions = [
            gemini_vision._failed_question(i, str(e)) for i in answer_key
        ]
    else:
        await apply_math_verification(questions, answer_key)
        await apply_feedback_provider(questions)

    meta.answerKeySource = answer_key_source
    _apply_row(row, questions, meta)
    logger.info(
        "regrade_done result_id=%s student=%s questions=%d",
        row.id, row.student_name, len(questions),
    )
    return row


async def regrade_test_rows(rows: list[models.GradingResult]) -> tuple[int, int]:
    """Kör om alla elevinlämningar i ett prov. Returnerar (ok, skipped)."""
    semaphore = asyncio.Semaphore(_MAX_CONCURRENT_REGRADE)
    ok = skipped = 0

    async def _one(row: models.GradingResult) -> bool:
        async with semaphore:
            try:
                await regrade_result_row(row)
                return True
            except RegradeUnavailable as e:
                logger.info("regrade_skipped result_id=%s reason=%s", row.id, e)
                return False

    outcomes = await asyncio.gather(*[_one(r) for r in rows])
    ok = sum(1 for o in outcomes if o)
    skipped = len(outcomes) - ok
    return ok, skipped
