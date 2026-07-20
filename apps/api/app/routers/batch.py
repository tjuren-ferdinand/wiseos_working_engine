"""Batch-rättning: ett anrop, alla elever rättade.

POST /api/v1/batch/grade  (multipart/form-data)
- prov_id: str (frontend-genererad UUID som även frontend lagrar)
- class_grading_parameters: str
- test_specific_parameters: str
- answer_key_json: str (JSON-serialiserad list[AnswerKeyItem])
- files: list[UploadFile] – en fil per elev (filnamnet ger studentnamn)

Returnerar BatchGradeResponse där varje BatchStudentResult.steps är
färdig att stoppas in i frontendens lib/store.ts utan transformation.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import ValidationError

from .. import schemas
from ..services.batch_pipeline import (
    UploadedFile,
    active_rules,
    grade_batch,
    integration_status,
)

router = APIRouter(prefix="/api/v1/batch", tags=["batch"])

MAX_FILES = 60
MAX_BYTES_PER_FILE = 15 * 1024 * 1024  # 15 MB
ALLOWED_MIMES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/heic",
    "application/pdf",
}


@router.post("/grade", response_model=schemas.BatchGradeResponse)
async def batch_grade(
    prov_id: str = Form(...),
    class_grading_parameters: str = Form(""),
    test_specific_parameters: str = Form(""),
    answer_key_json: str = Form(...),
    files: list[UploadFile] = File(...),
):
    # 1. Validera facit-JSON
    try:
        raw_items = json.loads(answer_key_json)
        answer_key = [schemas.AnswerKeyItem.model_validate(it) for it in raw_items]
    except (json.JSONDecodeError, ValidationError) as e:
        raise HTTPException(400, f"answer_key_json är inte giltig: {e!s}") from e
    if not answer_key:
        raise HTTPException(400, "answer_key_json måste innehålla minst en uppgift")

    # 2. Validera filer
    if not files:
        raise HTTPException(400, "Minst en fil måste laddas upp")
    if len(files) > MAX_FILES:
        raise HTTPException(413, f"Max {MAX_FILES} filer per batch")

    uploads: list[UploadedFile] = []
    for f in files:
        if f.content_type and f.content_type not in ALLOWED_MIMES:
            raise HTTPException(415, f"Filtyp {f.content_type} stöds inte ({f.filename})")
        data = await f.read()
        if len(data) > MAX_BYTES_PER_FILE:
            raise HTTPException(413, f"{f.filename} är större än 15 MB")
        uploads.append(
            UploadedFile(
                filename=f.filename or "okand.bin",
                content=data,
                content_type=f.content_type or "application/octet-stream",
            )
        )

    # 3. Kör pipelinen
    results = await grade_batch(
        prov_id=prov_id,
        answer_key=answer_key,
        class_grading_parameters=class_grading_parameters,
        test_specific_parameters=test_specific_parameters,
        files=uploads,
    )

    combined_params = f"{class_grading_parameters}\n{test_specific_parameters}"

    return schemas.BatchGradeResponse(
        provId=prov_id,
        results=results,
        activeRules=active_rules(combined_params),
        totalStudents=len(results),
        totalSteps=sum(len(r.steps) for r in results),
        integrations=integration_status(),
    )
