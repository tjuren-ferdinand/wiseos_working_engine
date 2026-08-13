from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field, ConfigDict


class AssignmentCreate(BaseModel):
    title: str
    subject: str | None = None
    grade_level: str | None = None
    problem_text: str | None = None
    correct_answer: str


class AssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    subject: str | None
    grade_level: str | None
    problem_text: str | None
    correct_answer: str
    created_at: datetime


class SubmissionCreate(BaseModel):
    assignment_id: str
    student_name: str
    answer_text: str
    ocr_confidence: float | None = None  # Sätts av frontend om svaret kom från OCR


class WolframResult(BaseModel):
    is_correct: bool
    confidence: float = Field(ge=0.0, le=1.0)
    steps_shown: list[str] = []
    alternative_forms: list[str] = []
    notes: str | None = None


class SubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    assignment_id: str
    student_name: str
    answer_text: str
    student_pseudonym: str | None = None
    score: int
    ai_feedback: str | None
    wolfram_verification: dict[str, Any] | None
    graded_at: datetime

    # Villkorad Automatisering
    ocr_confidence: float | None = None
    wolfram_confidence: float | None = None
    confidence_overall: float | None = None
    requires_review: bool = False
    review_status: str = "auto_approved"
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
    final_feedback: str | None = None
    final_score: int | None = None


class ReviewAction(BaseModel):
    # 'approve' | 'edit' | 'reject'
    action: str
    reviewed_by: str | None = None
    final_feedback: str | None = None
    final_score: int | None = None


class GradeResponse(BaseModel):
    submission: SubmissionOut
    wolfram: WolframResult
    feedback: str


class QuickGradeRequest(BaseModel):
    problem: str
    correct_answer: str
    student_answer: str


class QuickGradeResponse(BaseModel):
    score: int
    is_correct: bool
    feedback: str
    wolfram: WolframResult


class OcrRequest(BaseModel):
    image_base64: str


class OcrResponse(BaseModel):
    latex: str
    text: str
    confidence: float


class AnswerKeyItem(BaseModel):
    question_number: str
    final_answer: str
    derivation_steps: list[str] = []


# ---------------------------------------------------------------------------
# Batch grading – speglar frontendens StudentResult/GradingStep i lib/store.ts
# ---------------------------------------------------------------------------


class BatchGradingStep(BaseModel):
    """En rättningsruta i Workbench. Innehåller både AI-bedömning och
    metadata för att frontenden ska kunna re-derivera poäng dynamiskt när
    klassparametrarna ändras."""

    id: str
    label: str
    studentWork: str
    baseAnnotation: str
    appliedRules: list[str] = []  # frontend-kompatibel: "unit_penalty" | "sigfig_strict"
    aiVerdict: str  # "correct" | "partial" | "incorrect"
    pointsMax: float
    pointsBase: float
    pointsTeacher: float | None = None
    status: str = "ai_suggested"
    teacherComment: str | None = None
    # Diagnostik – syns inte i UI per default men låter pitch-demo lägga upp den vid behov
    confidence: float = 0.0
    wolframNotes: str | None = None


class BatchStudentResult(BaseModel):
    id: str
    provId: str
    studentName: str
    scanPages: list[str] = []  # data-URLs fylls på av frontenden, backend lämnar tom
    steps: list[BatchGradingStep]


class BatchGradeResponse(BaseModel):
    provId: str
    results: list[BatchStudentResult]
    # Vilka klassregler som matchade parametertexten — för transparens i UI:t
    activeRules: list[str] = []
    # Snabb summering för pitch/loggning
    totalStudents: int
    totalSteps: int
    integrations: dict[str, bool | str] = {}
