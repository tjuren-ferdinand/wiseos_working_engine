"""Klasser, elever och prov (Test) – persisterar det som tidigare bara
levde i frontendens Zustand-store (lib/store.ts: Kurs → Klass → Prov)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..db import get_db
from ..services.supabase_auth import SupabaseUser, get_current_supabase_user

router = APIRouter(prefix="/api/v1/classes", tags=["classes"])


def _get_owned_class(db: Session, class_id: str, teacher_id: str) -> models.Klass:
    """Hämtar en klass och verifierar att `teacher_id` äger den.

    404 (inte 403) oavsett om klassen saknas eller ägs av någon annan, för
    att inte läcka existensen av andra lärares resurser.
    """
    klass = (
        db.query(models.Klass)
        .options(selectinload(models.Klass.students))
        .filter(models.Klass.id == class_id, models.Klass.teacher_id == teacher_id)
        .first()
    )
    if not klass:
        raise HTTPException(404, "Class not found")
    return klass


@router.get("", response_model=list[schemas.ClassOut])
def list_classes(
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    return (
        db.query(models.Klass)
        .options(selectinload(models.Klass.students))
        .filter(models.Klass.teacher_id == _user.id)
        .order_by(models.Klass.created_at.desc())
        .all()
    )


@router.post("", response_model=schemas.ClassOut)
def create_class(
    payload: schemas.ClassCreate,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    klass = models.Klass(
        teacher_id=_user.id,
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


@router.get("/all-tests", response_model=list[schemas.TestOut], tags=["tests"])
def list_all_tests(
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    return (
        db.query(models.Test)
        .join(models.Klass, models.Test.klass_id == models.Klass.id)
        .filter(models.Klass.teacher_id == _user.id)
        .order_by(models.Test.created_at.desc())
        .all()
    )


@router.get("/{class_id}", response_model=schemas.ClassOut)
def get_class(
    class_id: str,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    return _get_owned_class(db, class_id, _user.id)


@router.patch("/{class_id}", response_model=schemas.ClassOut)
def update_class(
    class_id: str,
    payload: schemas.ClassUpdate,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    klass = _get_owned_class(db, class_id, _user.id)
    if payload.name is not None:
        klass.name = payload.name
    if payload.gradingParams is not None:
        klass.grading_params = payload.gradingParams.model_dump()
    if payload.gradeThresholds is not None:
        klass.grade_thresholds = payload.gradeThresholds.model_dump()
    db.commit()
    db.refresh(klass)
    return klass


@router.post("/{class_id}/students", response_model=schemas.StudentOut)
def add_student(
    class_id: str,
    payload: schemas.StudentIn,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    klass = _get_owned_class(db, class_id, _user.id)
    student = models.KlassStudent(klass_id=klass.id, name=payload.name, identifier=payload.identifier)
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.get("/{class_id}/tests", response_model=list[schemas.TestOut])
def list_tests(
    class_id: str,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    klass = _get_owned_class(db, class_id, _user.id)
    return (
        db.query(models.Test)
        .filter(models.Test.klass_id == klass.id)
        .order_by(models.Test.created_at.desc())
        .all()
    )


@router.post("/{class_id}/tests", response_model=schemas.TestOut)
def create_test(
    class_id: str,
    payload: schemas.TestCreate,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    klass = _get_owned_class(db, class_id, _user.id)
    test = models.Test(
        klass_id=klass.id,
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
def get_test(
    test_id: str,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    test = db.get(models.Test, test_id)
    if not test or test.klass.teacher_id != _user.id:
        raise HTTPException(404, "Test not found")
    return test


@router.patch("/tests/{test_id}", response_model=schemas.TestOut, tags=["tests"])
def update_test(
    test_id: str,
    payload: schemas.TestUpdate,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    test = db.get(models.Test, test_id)
    if not test or test.klass.teacher_id != _user.id:
        raise HTTPException(404, "Test not found")
    if payload.title is not None:
        test.title = payload.title
    if payload.date is not None:
        test.date = payload.date
    if payload.maxPoints is not None:
        test.max_points = payload.maxPoints
    if payload.facitMode is not None:
        test.facit_mode = payload.facitMode
    if payload.customParams is not None:
        test.custom_params = payload.customParams
    if payload.questions is not None:
        test.questions = [q.model_dump() for q in payload.questions]
    if payload.status is not None:
        test.status = payload.status
    db.commit()
    db.refresh(test)
    return test


# ---------------------------------------------------------------------------
# Hard delete – GDPR-sprint v1 (Vecka 2). Permanent radering, ingen "soft
# delete"/papperskorg. Cascade ("all, delete-orphan") sköter Klass -> Students
# + Tests, och Test -> GradingResults + AnswerKeyRecord, se models.py.
# ---------------------------------------------------------------------------


@router.delete("/{class_id}", status_code=204)
def delete_class(
    class_id: str,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    klass = _get_owned_class(db, class_id, _user.id)
    db.delete(klass)
    db.commit()


@router.delete("/{class_id}/students/{student_id}", status_code=204)
def delete_student(
    class_id: str,
    student_id: str,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    klass = _get_owned_class(db, class_id, _user.id)
    student = (
        db.query(models.KlassStudent)
        .filter(models.KlassStudent.id == student_id, models.KlassStudent.klass_id == klass.id)
        .first()
    )
    if not student:
        raise HTTPException(404, "Student not found")
    # OBS: GradingResult.student_id är INTE en riktig ForeignKey (fritt fält
    # för fuzzy identifiering) och raderas därför inte automatiskt via cascade.
    # Vi rensar manuellt de GradingResults i klassens prov som pekar på detta
    # elev-id, så att inga kvarvarande poster förblir kopplade till ett
    # elev-id som inte längre existerar.
    # See also: models.py GradingResult.student_id KNOWN-ISSUE comment.
    # The FK ondelete="SET NULL" is declared in the model but not enforced at DB
    # level. This manual hard-delete is the actual cleanup mechanism. If the FK
    # is ever enforced, this manual delete must be reconciled with SET NULL semantics.
    (
        db.query(models.GradingResult)
        .filter(
            models.GradingResult.student_id == student_id,
            models.GradingResult.test_id.in_(
                db.query(models.Test.id).filter(models.Test.klass_id == klass.id)
            ),
        )
        .delete(synchronize_session=False)
    )
    db.delete(student)
    db.commit()


@router.delete("/tests/{test_id}", status_code=204, tags=["tests"])
def delete_test(
    test_id: str,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    test = db.get(models.Test, test_id)
    if not test or test.klass.teacher_id != _user.id:
        raise HTTPException(404, "Test not found")
    db.delete(test)
    db.commit()
