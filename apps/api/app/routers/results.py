"""Persisterade rättningsresultat (GradingResult) – ett per elev och prov.

Batch-pipelinen (routers/batch.py) skriver hit efter rättning så att
resultaten finns kvar mellan sessioner och kan hämtas av flera klienter."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/api/v1/results", tags=["results"])


@router.get("", response_model=list[schemas.GradingResultOut])
def list_results(
    test_id: str | None = Query(None, alias="testId"),
    db: Session = Depends(get_db),
):
    q = db.query(models.GradingResult)
    if test_id:
        q = q.filter(models.GradingResult.test_id == test_id)
    return q.order_by(models.GradingResult.scanned_at.desc()).all()


@router.post("", response_model=schemas.GradingResultOut)
def create_result(payload: schemas.GradingResultCreate, db: Session = Depends(get_db)):
    test = db.get(models.Test, payload.testId)
    if not test:
        raise HTTPException(404, "Test not found")

    result = models.GradingResult(
        test_id=payload.testId,
        student_name=payload.studentName,
        student_id=payload.studentId,
        identification_method=payload.identificationMethod,
        identification_confidence=payload.identificationConfidence,
        steps=[s.model_dump() for s in payload.steps],
        total_score=payload.totalScore,
        max_score=payload.maxScore,
        percentage=payload.percentage,
        grade=payload.grade,
        feedback=payload.feedback,
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


@router.get("/{result_id}", response_model=schemas.GradingResultOut)
def get_result(result_id: str, db: Session = Depends(get_db)):
    result = db.get(models.GradingResult, result_id)
    if not result:
        raise HTTPException(404, "Result not found")
    return result
