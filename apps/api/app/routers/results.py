"""Persisterade rättningsresultat (GradingResult) – ett per elev och prov.

Batch-pipelinen (routers/batch.py) skriver hit efter rättning så att
resultaten finns kvar mellan sessioner och kan hämtas av flera klienter."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..db import get_db
from ..services.supabase_auth import SupabaseUser, get_current_supabase_user

router = APIRouter(prefix="/api/v1/results", tags=["results"])


def _get_owned_test(db: Session, test_id: str, teacher_id: str) -> models.Test:
    """Hämtar ett Test och verifierar ägandeskap via dess Klass."""
    test = (
        db.query(models.Test)
        .join(models.Klass)
        .filter(models.Test.id == test_id, models.Klass.teacher_id == teacher_id)
        .first()
    )
    if not test:
        raise HTTPException(404, "Test not found")
    return test


@router.get("", response_model=list[schemas.GradingResultListItem])
def list_results(
    test_id: str | None = Query(None, alias="testId"),
    skip: int | None = Query(None, ge=0),
    limit: int | None = Query(None, ge=1),
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    q = (
        db.query(models.GradingResult)
        .options(selectinload(models.GradingResult.test))
        .join(models.Test)
        .join(models.Klass)
        .filter(models.Klass.teacher_id == _user.id)
    )
    if test_id:
        q = q.filter(models.GradingResult.test_id == test_id)
    q = q.order_by(models.GradingResult.scanned_at.desc())
    if skip is not None:
        q = q.offset(skip)
    if limit is not None:
        q = q.limit(limit)
    return q.all()


@router.post("", response_model=schemas.GradingResultOut)
def create_result(
    payload: schemas.GradingResultCreate,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    test = _get_owned_test(db, payload.testId, _user.id)

    result = models.GradingResult(
        test_id=payload.testId,
        student_name=payload.studentName,
        student_id=payload.studentId,
        identification_method=payload.identificationMethod,
        identification_confidence=payload.identificationConfidence,
        scan_pages=payload.scanPages,
        document=payload.document.model_dump() if payload.document else None,
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


@router.patch("/{result_id}", response_model=schemas.GradingResultOut)
def update_result(
    result_id: str,
    payload: schemas.GradingResultUpdate,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    result = (
        db.query(models.GradingResult)
        .join(models.Test)
        .join(models.Klass)
        .filter(models.GradingResult.id == result_id, models.Klass.teacher_id == _user.id)
        .first()
    )
    if not result:
        raise HTTPException(404, "Result not found")
    if payload.steps is not None:
        result.steps = [s.model_dump() for s in payload.steps]
    if payload.totalScore is not None:
        result.total_score = payload.totalScore
    if payload.maxScore is not None:
        result.max_score = payload.maxScore
    if payload.percentage is not None:
        result.percentage = payload.percentage
    if payload.grade is not None:
        result.grade = payload.grade
    if payload.feedback is not None:
        result.feedback = payload.feedback
    db.commit()
    db.refresh(result)
    return result


@router.get("/{result_id}", response_model=schemas.GradingResultOut)
def get_result(
    result_id: str,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    result = (
        db.query(models.GradingResult)
        .join(models.Test)
        .join(models.Klass)
        .filter(models.GradingResult.id == result_id, models.Klass.teacher_id == _user.id)
        .first()
    )
    if not result:
        raise HTTPException(404, "Result not found")
    return result


@router.delete("/{result_id}", status_code=204)
def delete_result(
    result_id: str,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    """Hard delete av ett enskilt elevresultat – GDPR-sprint v1 (Vecka 2).

    T.ex. om en elev/vårdnadshavare begär radering av just sitt resultat
    utan att hela provet/klassen ska påverkas.
    """
    result = (
        db.query(models.GradingResult)
        .join(models.Test)
        .join(models.Klass)
        .filter(models.GradingResult.id == result_id, models.Klass.teacher_id == _user.id)
        .first()
    )
    if not result:
        raise HTTPException(404, "Result not found")
    db.delete(result)
    db.commit()
