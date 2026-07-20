from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings
from ..db import get_db
from ..services.wolfram import WolframVerifier
from ..services.feedback import generate_feedback
from ..services.anonymize import pseudonymize_student

router = APIRouter(prefix="/api/v1/submissions", tags=["submissions"])


@router.post("/grade", response_model=schemas.GradeResponse)
async def grade_submission(payload: schemas.SubmissionCreate, db: Session = Depends(get_db)):
    assignment = db.get(models.Assignment, payload.assignment_id)
    if not assignment:
        raise HTTPException(404, "Assignment not found")

    verifier = WolframVerifier()
    wolfram = await verifier.verify_equation(payload.answer_text, assignment.correct_answer)

    feedback = await generate_feedback(
        problem=assignment.problem_text or assignment.title,
        student_answer=payload.answer_text,
        correct_answer=assignment.correct_answer,
        wolfram=wolfram,
    )

    score = 100 if wolfram.is_correct else (50 if wolfram.confidence >= 0.7 else 0)

    # Villkorad Automatisering: aggregera konfidens och avgör om manuell granskning krävs.
    ocr_conf = payload.ocr_confidence if payload.ocr_confidence is not None else 1.0
    confidence_overall = min(ocr_conf, wolfram.confidence)
    requires_review = confidence_overall < settings.REVIEW_CONFIDENCE_THRESHOLD
    review_status = "pending_review" if requires_review else "auto_approved"

    sub = models.Submission(
        assignment_id=assignment.id,
        student_name=payload.student_name,
        student_pseudonym=pseudonymize_student(payload.student_name),
        answer_text=payload.answer_text,
        score=score,
        ai_feedback=feedback,
        wolfram_verification=wolfram.model_dump(),
        ocr_confidence=payload.ocr_confidence,
        wolfram_confidence=wolfram.confidence,
        confidence_overall=confidence_overall,
        requires_review=requires_review,
        review_status=review_status,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    return schemas.GradeResponse(
        submission=schemas.SubmissionOut.model_validate(sub),
        wolfram=wolfram,
        feedback=feedback,
    )


@router.get("/pending", response_model=list[schemas.SubmissionOut], tags=["review"])
def list_pending_reviews(db: Session = Depends(get_db)):
    """Alla inlämningar som väntar på lärargranskning (konfidens < tröskel)."""
    return (
        db.query(models.Submission)
        .filter(models.Submission.review_status == "pending_review")
        .order_by(models.Submission.graded_at.desc())
        .all()
    )


@router.post("/{submission_id}/review", response_model=schemas.SubmissionOut, tags=["review"])
def review_submission(submission_id: str, action: schemas.ReviewAction, db: Session = Depends(get_db)):
    sub = db.get(models.Submission, submission_id)
    if not sub:
        raise HTTPException(404, "Submission not found")

    if action.action not in {"approve", "edit", "reject"}:
        raise HTTPException(400, "action måste vara 'approve', 'edit' eller 'reject'")

    sub.reviewed_by = action.reviewed_by or "anonymous"
    sub.reviewed_at = datetime.utcnow()
    sub.requires_review = False

    if action.action == "approve":
        sub.review_status = "approved"
        # Lärarens godkända poäng/feedback = AI:s
        sub.final_score = sub.score
        sub.final_feedback = sub.ai_feedback
    elif action.action == "edit":
        sub.review_status = "edited"
        sub.final_feedback = action.final_feedback or sub.ai_feedback
        sub.final_score = action.final_score if action.final_score is not None else sub.score
    else:  # reject
        sub.review_status = "rejected"
        sub.final_score = 0
        sub.final_feedback = action.final_feedback

    db.commit()
    db.refresh(sub)
    return sub


@router.post("/quick-grade", response_model=schemas.QuickGradeResponse, tags=["grade"])
async def quick_grade(req: schemas.QuickGradeRequest):
    """Stateless rättning – sparar inget i databasen.

    Användbar för testning, externa integrationer och Wolfram Cloud-piloter.
    """
    verifier = WolframVerifier()
    wolfram = await verifier.verify_equation(req.student_answer, req.correct_answer)
    feedback = await generate_feedback(
        problem=req.problem,
        student_answer=req.student_answer,
        correct_answer=req.correct_answer,
        wolfram=wolfram,
    )
    score = 100 if wolfram.is_correct else (50 if wolfram.confidence >= 0.7 else 0)
    return schemas.QuickGradeResponse(
        score=score,
        is_correct=wolfram.is_correct,
        feedback=feedback,
        wolfram=wolfram,
    )


@router.get("/{submission_id}", response_model=schemas.SubmissionOut)
def get_submission(submission_id: str, db: Session = Depends(get_db)):
    s = db.get(models.Submission, submission_id)
    if not s:
        raise HTTPException(404, "Submission not found")
    return s
