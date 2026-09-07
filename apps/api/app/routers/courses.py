from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..services.supabase_auth import SupabaseUser, get_current_supabase_user

router = APIRouter(prefix="/api/v1/courses", tags=["courses"])


def _get_owned_course(db: Session, course_id: str, teacher_id: str) -> models.Course:
    course = (
        db.query(models.Course)
        .filter(models.Course.id == course_id, models.Course.teacher_id == teacher_id)
        .first()
    )
    if not course:
        raise HTTPException(404, "Course not found")
    return course


@router.get("", response_model=list[schemas.CourseOut])
def list_courses(
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    return (
        db.query(models.Course)
        .filter(models.Course.teacher_id == _user.id)
        .order_by(models.Course.created_at.desc())
        .all()
    )


@router.post("", response_model=schemas.CourseOut)
def create_course(
    payload: schemas.CourseCreate,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    course = models.Course(
        teacher_id=_user.id,
        name=payload.name,
        code=payload.code,
        subject=payload.subject,
        level=payload.level,
        description=payload.description,
        grade_thresholds=payload.gradeThresholds.model_dump(),
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.get("/{course_id}", response_model=schemas.CourseOut)
def get_course(
    course_id: str,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    return _get_owned_course(db, course_id, _user.id)


@router.patch("/{course_id}", response_model=schemas.CourseOut)
def update_course(
    course_id: str,
    payload: schemas.CourseUpdate,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    course = _get_owned_course(db, course_id, _user.id)
    if payload.name is not None:
        course.name = payload.name
    if payload.code is not None:
        course.code = payload.code
    if payload.subject is not None:
        course.subject = payload.subject
    if "level" in payload.model_fields_set:
        course.level = payload.level
    if payload.description is not None:
        course.description = payload.description
    if payload.gradeThresholds is not None:
        course.grade_thresholds = payload.gradeThresholds.model_dump()
    db.commit()
    db.refresh(course)
    return course


@router.delete("/{course_id}", status_code=204)
def delete_course(
    course_id: str,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    course = _get_owned_course(db, course_id, _user.id)
    referenced = (
        db.query(models.Klass.id)
        .filter(models.Klass.teacher_id == _user.id, models.Klass.kurs_id == course.id)
        .first()
    )
    if referenced:
        raise HTTPException(409, "Course is referenced by one or more classes")
    db.delete(course)
    db.commit()
