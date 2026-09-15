"""Batch-rättning: ett anrop, alla elever rättade.

POST /api/v1/batch/grade  (multipart/form-data)
- prov_id: str (frontend-genererad UUID som även frontend lagrar)
- class_grading_parameters: str
- test_specific_parameters: str
- answer_key_json: str (JSON-serialiserad list[AnswerKeyItem])
- files: list[UploadFile] – en eller flera filer per elev. Filnamnet ger
  studentnamn, och ett sidnummersuffix ("Anna_Andersson_sida2.jpg") grupperar
  flera sidor till ETT elevdokument.

Returnerar BatchGradeResponse med kanoniska StudentDocumentResult som
frontenden konsumerar direkt, utan egen tolkning.
"""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..db import get_db
from ..services.rate_limits import limit_batch_grade
from ..services.supabase_auth import SupabaseUser, get_current_supabase_user
from ..services.answer_key import QuestionSheetInferenceError, infer_question_sheet
from ..services.batch_pipeline import (
    UploadedFile,
    scanner_group,
    active_rules,
    expand_pdf_uploads,
    grade_batch,
    integration_status,
    build_grading_steps,
)

logger = logging.getLogger("wiseos.grading")

router = APIRouter(prefix="/api/v1/batch", tags=["batch"])

MAX_FILES = 60
MAX_BYTES_PER_FILE = 100 * 1024 * 1024  # 100 MB — en skannad provbunt kan vara stor
MAX_BYTES_TOTAL = 200 * 1024 * 1024  # 200 MB sammanlagt per batch
ALLOWED_MIMES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/heic",
    "application/pdf",
}


def _matching_student(test: models.Test, student_name: str) -> models.KlassStudent | None:
    normalized = " ".join(student_name.casefold().split())
    matches = [
        student
        for student in test.klass.students
        if " ".join(student.name.casefold().split()) == normalized
    ]
    return matches[0] if len(matches) == 1 else None


def _grading_steps(result: schemas.StudentDocumentResult) -> list[dict]:
    return build_grading_steps(result.id, result.questions)


# Live-status per pågående batch — processlokal (en worker per tjänst idag).
# Nyckel: test_id. Värde: {"running", "total", "done", "active", "started_at", "error"}.
_BATCH_JOBS: dict[str, dict] = {}


def _persist_result(
    db: Session,
    test: models.Test,
    result: schemas.StudentDocumentResult,
) -> None:
    """Persistar ETT elevresultat direkt när det blir klart — gör att
    frontenden kan polla och visa eleverna i realtid under rättningen."""
    student = _matching_student(test, result.studentName)
    student_id = student.id if student else None
    steps = _grading_steps(result)
    total_score = round(sum(step["earnedPoints"] for step in steps), 2)
    max_score = round(sum(step["maxPoints"] for step in steps), 2)
    percentage = round(total_score / max_score * 100, 2) if max_score else 0.0

    row = (
        db.query(models.GradingResult)
        .filter(
            models.GradingResult.test_id == test.id,
            models.GradingResult.student_id == student_id
            if student_id
            else models.GradingResult.student_id.is_(None),
            models.GradingResult.student_name == result.studentName,
        )
        .first()
    )
    if row is None:
        row = models.GradingResult(test_id=test.id, student_name=result.studentName)
        db.add(row)

    row.student_name = result.studentName
    row.student_id = student_id
    row.identification_method = result.identificationMethod
    row.identification_confidence = result.identificationConfidence
    row.scan_pages = result.scanPages
    row.document = result.document.model_dump(mode="json")
    row.steps = steps
    row.total_score = total_score
    row.max_score = max_score
    row.percentage = percentage
    row.graded_at = datetime.utcnow()
    test.status = "review"
    db.flush()
    db.commit()
    result.id = row.id
    result.studentId = student_id


def _persist_batch(
    db: Session,
    test: models.Test,
    results: list[schemas.StudentDocumentResult],
    answer_key: list[schemas.AnswerKeyItem],
    answer_key_source: str | None = None,
) -> None:
    if answer_key_source is None:
        answer_key_source = "generated" if test.facit_mode == "ai_generated" else "uploaded"
    if answer_key:
        items = [item.model_dump(mode="json") for item in answer_key]
        if test.answer_key:
            test.answer_key.items = items
            test.answer_key.source = answer_key_source
        else:
            db.add(
                models.AnswerKeyRecord(
                    test_id=test.id,
                    items=items,
                    source=answer_key_source,
                )
            )
        test.questions = [
            {
                "id": f"{test.id}-q{item.question_number}",
                "number": item.question_number,
                "maxPoints": item.max_points,
            }
            for item in answer_key
        ]
        test.max_points = round(sum(item.max_points for item in answer_key))

    # Hämta alla befintliga resultat för detta provet på en gång — undvik
    # en SELECT per elev i loopen nedan.
    existing_rows: dict[tuple[str | None, str], models.GradingResult] = {}
    if results:
        student_ids = {r.studentId for r in results if r.studentId}
        query = db.query(models.GradingResult).filter(models.GradingResult.test_id == test.id)
        if student_ids:
            q1 = query.filter(models.GradingResult.student_id.in_(student_ids))
            q2 = query.filter(
                models.GradingResult.student_id.is_(None),
                models.GradingResult.student_name.in_(
                    {r.studentName for r in results if not r.studentId}
                ),
            )
            rows = q1.union(q2).all()
        else:
            rows = query.filter(
                models.GradingResult.student_id.is_(None),
                models.GradingResult.student_name.in_(
                    {r.studentName for r in results}
                ),
            ).all()
        for row in rows:
            key = (row.student_id or None, row.student_name)
            existing_rows[key] = row

    for result in results:
        student = _matching_student(test, result.studentName)
        student_id = student.id if student else None
        steps = _grading_steps(result)
        total_score = round(sum(step["earnedPoints"] for step in steps), 2)
        max_score = round(sum(step["maxPoints"] for step in steps), 2)
        percentage = round(total_score / max_score * 100, 2) if max_score else 0.0

        lookup_key: tuple[str | None, str] = (student_id, result.studentName)
        row = existing_rows.get(lookup_key)
        if row is None:
            row = models.GradingResult(test_id=test.id, student_name=result.studentName)
            db.add(row)
            existing_rows[lookup_key] = row

        row.student_name = result.studentName
        row.student_id = student_id
        row.identification_method = result.identificationMethod
        row.identification_confidence = result.identificationConfidence
        row.scan_pages = result.scanPages
        row.document = result.document.model_dump(mode="json")
        row.steps = steps
        row.total_score = total_score
        row.max_score = max_score
        row.percentage = percentage
        row.graded_at = datetime.utcnow()
        db.flush()
        result.id = row.id
        result.studentId = student_id

    test.status = "review"
    db.commit()


@router.post("/grade", response_model=schemas.BatchGradeResponse, dependencies=[Depends(limit_batch_grade)])
async def batch_grade(
    prov_id: str = Form(...),
    class_grading_parameters: str = Form(""),
    test_specific_parameters: str = Form(""),
    answer_key_json: str = Form("[]"),
    identification_method: str = Form("name_field"),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    test = (
        db.query(models.Test)
        .options(
            selectinload(models.Test.klass).selectinload(models.Klass.students),
            selectinload(models.Test.answer_key),
        )
        .join(models.Klass)
        .filter(models.Test.id == prov_id, models.Klass.teacher_id == _user.id)
        .first()
    )
    if not test:
        raise HTTPException(404, "Test not found")
    if identification_method != "name_field":
        raise HTTPException(422, f"Identifieringsmetoden {identification_method!r} stöds inte ännu")

    # 1. Validera facit-JSON (valfritt – tomt betyder facitfri rättning)
    try:
        raw_items = json.loads(answer_key_json or "[]")
        answer_key = [schemas.AnswerKeyItem.model_validate(it) for it in raw_items]
    except (json.JSONDecodeError, ValidationError) as e:
        raise HTTPException(400, f"answer_key_json är inte giltig: {e!s}") from e

    # 2. Validera filer
    if not files:
        raise HTTPException(400, "Minst en fil måste laddas upp")
    if len(files) > MAX_FILES:
        raise HTTPException(413, f"Max {MAX_FILES} filer per batch")

    uploads: list[UploadedFile] = []
    total_bytes = 0
    for f in files:
        if f.content_type and f.content_type not in ALLOWED_MIMES:
            raise HTTPException(415, f"Filtyp {f.content_type} stöds inte ({f.filename})")
        data = await f.read()
        if len(data) > MAX_BYTES_PER_FILE:
            raise HTTPException(413, f"{f.filename} är större än 100 MB")
        total_bytes += len(data)
        if total_bytes > MAX_BYTES_TOTAL:
            raise HTTPException(
                413, "Batchen är sammanlagt större än 200 MB — dela upp i fler omgångar"
            )
        uploads.append(
            UploadedFile(
                filename=f.filename or "okand.bin",
                content=data,
                content_type=f.content_type or "application/octet-stream",
            )
        )
    try:
        uploads = expand_pdf_uploads(uploads)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    # 3. Bestäm bedömningsunderlag. Ett e00-dokument är lärarens explicita
    # frågeblads-/facitfas. I facitfritt läge infereras ett konsekvent underlag
    # en gång och används för alla elever — e00 rättas aldrig som elevarbete.
    answer_key_source = (
        "generated"
        if answer_key and test.facit_mode == "ai_generated"
        else "uploaded"
        if answer_key
        else "none"
    )
    reference_pages = [
        (upload.content, upload.content_type)
        for upload in uploads
        if scanner_group(upload.filename) == 0
    ]
    if not answer_key and reference_pages:
        inference_started = time.perf_counter()
        try:
            answer_key = await infer_question_sheet(reference_pages)
        except QuestionSheetInferenceError as exc:
            messages = {
                "invalid_json": "AI-svaret kunde inte tolkas. Försök igen.",
                "provider_error": "AI-tjänsten kunde inte analysera frågebladet. Försök igen.",
                "no_primary_document": "Kunde inte avgränsa frågebladet från resten av bilden. Centrera huvudpappret i ramen.",
                "multiple_documents": "Flera dokument syns lika tydligt. Centrera frågebladet och låt grannbilden ligga utanför ramen.",
                "no_questions": "Pappersytan hittades, men inga läsbara frågor kunde identifieras.",
            }
            logger.warning(
                "question_sheet_inference_stopped prov_id=%s kind=%s latency_ms=%d",
                prov_id,
                exc.kind,
                int((time.perf_counter() - inference_started) * 1000),
            )
            raise HTTPException(422, messages.get(exc.kind, "Frågebladet kunde inte analyseras.")) from exc
        logger.info(
            "question_sheet_inferred prov_id=%s pages=%d questions=%d latency_ms=%d",
            prov_id,
            len(reference_pages),
            len(answer_key),
            int((time.perf_counter() - inference_started) * 1000),
        )
        answer_key_source = "inferred_question_sheet"

    # 4. Kör pipelinen. Logga metadata, inte elevdata.
    logger.info(
        "batch_request prov_id=%s uploads=%d answer_key_items=%d source=%s",
        prov_id, len(uploads), len(answer_key), answer_key_source,
    )
    job = {
        "running": True,
        "total": 0,
        "done": 0,
        "active": {},
        "started_at": datetime.utcnow().isoformat(),
        "error": None,
    }
    _BATCH_JOBS[test.id] = job

    def _on_result(result: schemas.StudentDocumentResult) -> None:
        _persist_result(db, test, result)

    try:
        results = await grade_batch(
            prov_id=prov_id,
            answer_key=answer_key,
            class_grading_parameters=class_grading_parameters,
            test_specific_parameters=test_specific_parameters,
            files=uploads,
            identification_method=identification_method,
            answer_key_source=answer_key_source,
            progress=job,
            on_result=_on_result,
        )
    except Exception as exc:
        job["running"] = False
        job["error"] = str(exc)
        raise

    _persist_batch(db, test, results, answer_key, answer_key_source)
    job["running"] = False
    job["done"] = len(results)
    job["active"] = {}
    combined_params = f"{class_grading_parameters}\n{test_specific_parameters}"

    return schemas.BatchGradeResponse(
        provId=prov_id,
        results=results,
        activeRules=active_rules(combined_params),
        totalStudents=sum(
            r.document.documentType != "not_student_submission" for r in results
        ),
        totalQuestions=sum(
            len(r.questions)
            for r in results
            if r.document.documentType != "not_student_submission"
        ),
        integrations=integration_status(),
    )


@router.get("/status/{test_id}")
def batch_status(
    test_id: str,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    """Live-status för en pågående batch — teacher-scoped.

    Frontenden poll-ar denna + /results under rättningen så att eleverna
    ploppar in i realtid. Okänt prov eller avslutat jobb → running=false.
    """
    test = (
        db.query(models.Test)
        .join(models.Klass)
        .filter(models.Test.id == test_id, models.Klass.teacher_id == _user.id)
        .first()
    )
    if not test:
        raise HTTPException(404, "Test not found")
    job = _BATCH_JOBS.get(test_id)
    if not job:
        return {"running": False, "total": 0, "done": 0, "active": [], "error": None}
    return {
        "running": job["running"],
        "total": job["total"],
        "done": job["done"],
        "active": sorted(set(job["active"].values())),
        "error": job["error"],
    }
