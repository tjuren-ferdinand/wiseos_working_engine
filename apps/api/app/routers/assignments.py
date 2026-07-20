from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/api/v1/assignments", tags=["assignments"])


@router.post("", response_model=schemas.AssignmentOut)
def create_assignment(payload: schemas.AssignmentCreate, db: Session = Depends(get_db)):
    a = models.Assignment(
        title=payload.title,
        subject=payload.subject,
        grade_level=payload.grade_level,
        problem_text=payload.problem_text,
        correct_answer=payload.correct_answer,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.get("", response_model=list[schemas.AssignmentOut])
def list_assignments(db: Session = Depends(get_db)):
    return db.query(models.Assignment).order_by(models.Assignment.created_at.desc()).all()


@router.get("/{assignment_id}", response_model=schemas.AssignmentOut)
def get_assignment(assignment_id: str, db: Session = Depends(get_db)):
    a = db.get(models.Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")
    return a


@router.get("/{assignment_id}/results", response_model=list[schemas.SubmissionOut])
def list_results(assignment_id: str, db: Session = Depends(get_db)):
    a = db.get(models.Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")
    return (
        db.query(models.Submission)
        .filter(models.Submission.assignment_id == assignment_id)
        .order_by(models.Submission.graded_at.desc())
        .all()
    )
