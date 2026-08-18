"""Klasser, elever och prov (Test) – persisterar det som tidigare bara
levde i frontendens Zustand-store (lib/store.ts: Kurs → Klass → Prov)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/api/v1/classes", tags=["classes"])


@router.get("", response_model=list[schemas.ClassOut])
def list_classes(db: Session = Depends(get_db)):
    return (
        db.query(models.Klass)
        .options(selectinload(models.Klass.students))
        .order_by(models.Klass.created_at.desc())
        .all()
    )


@router.post("", response_model=schemas.ClassOut)
def create_class(payload: schemas.ClassCreate, db: Session = Depends(get_db)):
    klass = models.Klass(
        name=payload.name,
        kurs_id=payload.kursId,
        grading_params=payload.gradingParams.model_dump() if payload.gradingParams else None,
        grade_thresholds=payload.gradeThresholds.model_dump() if payload.gradeThresholds else None,
    )
    db.add(klass)
    db.flush()

    for s in payload.students:
        db.add(models.KlassStudent(klass_id=klass.id, name=s.name, identifier=s.identifier))

    db.commit()
    db.refresh(klass)
    return klass


@router.get("/{class_id}", response_model=schemas.ClassOut)
def get_class(class_id: str, db: Session = Depends(get_db)):
    klass = (
        db.query(models.Klass)
        .options(selectinload(models.Klass.students))
        .filter(models.Klass.id == class_id)
        .first()
    )
    if not klass:
        raise HTTPException(404, "Class not found")
    return klass


@router.post("/{class_id}/students", response_model=schemas.StudentOut)
def add_student(class_id: str, payload: schemas.StudentIn, db: Session = Depends(get_db)):
    klass = db.get(models.Klass, class_id)
    if not klass:
        raise HTTPException(404, "Class not found")
    student = models.KlassStudent(klass_id=class_id, name=payload.name, identifier=payload.identifier)
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.get("/{class_id}/tests", response_model=list[schemas.TestOut])
def list_tests(class_id: str, db: Session = Depends(get_db)):
    klass = db.get(models.Klass, class_id)
    if not klass:
        raise HTTPException(404, "Class not found")
    return (
        db.query(models.Test)
        .filter(models.Test.klass_id == class_id)
        .order_by(models.Test.created_at.desc())
        .all()
    )


@router.post("/{class_id}/tests", response_model=schemas.TestOut)
def create_test(class_id: str, payload: schemas.TestCreate, db: Session = Depends(get_db)):
    klass = db.get(models.Klass, class_id)
    if not klass:
        raise HTTPException(404, "Class not found")
    test = models.Test(
        klass_id=class_id,
        title=payload.title,
        date=payload.date,
        max_points=payload.maxPoints,
        facit_mode=payload.facitMode,
        custom_params=payload.customParams,
        questions=[q.model_dump() for q in payload.questions],
        status=payload.status,
    )
    db.add(test)
    db.commit()
    db.refresh(test)
    return test


@router.get("/tests/{test_id}", response_model=schemas.TestOut, tags=["tests"])
def get_test(test_id: str, db: Session = Depends(get_db)):
    test = db.get(models.Test, test_id)
    if not test:
        raise HTTPException(404, "Test not found")
    return test
