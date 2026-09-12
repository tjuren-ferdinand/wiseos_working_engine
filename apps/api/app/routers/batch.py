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
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..db import get_db
from ..services.rate_limits import limit_batch_grade
from ..services.supabase_auth import SupabaseUser, get_current_supabase_user
from ..services.batch_pipeline import (
    UploadedFile,
    active_rules,
    expand_pdf_uploads,
    grade_batch,
    integration_status,
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
    return [
        schemas.GradingStepSchema(
            id=f"{result.id}-q{question.questionNumber}",
            questionId=question.questionNumber,
            label=(
                f"Uppgift {question.questionNumber}"
                if question.inAnswerKey
                else f"Uppgift {question.questionNumber} (ej i facit)"
            ),
            questionText=question.questionText,
            maxPoints=question.assessment.maxPoints,
            earnedPoints=question.pointsTeacher if question.pointsTeacher is not None else question.assessment.points,
            status=question.assessment.status,
            feedback=question.feedback,
            studentWork=question.studentWork,
            correctAnswer=question.correctAnswer,
            found=question.found,
            transcriptionConfidence=question.transcriptionConfidence,
            annotation=question.annotation,
            error=question.error,
            outsideAnswerKey=not question.inAnswerKey,
            sourceRegions=question.sourceRegions,
            mathVerification=question.mathVerification,
            feedbackProvider=question.feedbackProvider,
        ).model_dump(mode="json")
        for question in result.questions
    ]


def _persist_batch(
    db: Session,
    test: models.Test,
    results: list[schemas.StudentDocumentResult],
    answer_key: list[schemas.AnswerKeyItem],
) -> None:
    if answer_key:
        items = [item.model_dump(mode="json") for item in answer_key]
        if test.answer_key:
            test.answer_key.items = items
            test.answer_key.source = "generated" if test.facit_mode == "ai_generated" else "uploaded"
        else:
            db.add(
                models.AnswerKeyRecord(
                    test_id=test.id,
                    items=items,
                    source="generated" if test.facit_mode == "ai_generated" else "uploaded",
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

    # 3. Kör pipelinen. Logga metadata, inte elevdata.
    logger.info(
        "batch_request prov_id=%s uploads=%d answer_key_items=%d",
        prov_id, len(uploads), len(answer_key),
    )
    results = await grade_batch(
        prov_id=prov_id,
        answer_key=answer_key,
        class_grading_parameters=class_grading_parameters,
        test_specific_parameters=test_specific_parameters,
        files=uploads,
        identification_method=identification_method,
    )

    _persist_batch(db, test, results, answer_key)
    combined_params = f"{class_grading_parameters}\n{test_specific_parameters}"

    return schemas.BatchGradeResponse(
        provId=prov_id,
        results=results,
        activeRules=active_rules(combined_params),
        totalStudents=len(results),
        totalQuestions=sum(len(r.questions) for r in results),
        integrations=integration_status(),
    )
