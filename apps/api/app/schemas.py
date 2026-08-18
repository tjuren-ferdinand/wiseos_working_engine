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


# ---------------------------------------------------------------------------
# V2 – Kurs → Klass → Test(Prov) → GradingResult
# Persisterar det som tidigare bara låg i frontendens Zustand-store.
# ---------------------------------------------------------------------------


class GradingParamsSchema(BaseModel):
    allowPartialCredit: bool = True
    unitErrorPenalty: float = 0.5
    roundingTolerance: float = 5
    requireWorkShown: bool = True
    significantFigures: bool = True
    customRules: list[str] = []


class GradeThresholdsSchema(BaseModel):
    A: float = 90
    B: float = 80
    C: float = 65
    D: float = 50
    E: float = 35
    F: float = 0


class StudentIn(BaseModel):
    name: str
    identifier: str | None = None


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    identifier: str | None = None


class ClassCreate(BaseModel):
    name: str
    kursId: str
    students: list[StudentIn] = []
    gradingParams: GradingParamsSchema | None = None
    gradeThresholds: GradeThresholdsSchema | None = None


class ClassOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    kursId: str = Field(validation_alias="kurs_id", serialization_alias="kursId")
    students: list[StudentOut] = []
    gradingParams: dict[str, Any] | None = Field(default=None, validation_alias="grading_params", serialization_alias="gradingParams")
    gradeThresholds: dict[str, Any] | None = Field(default=None, validation_alias="grade_thresholds", serialization_alias="gradeThresholds")
    createdAt: datetime = Field(validation_alias="created_at", serialization_alias="createdAt")


class QuestionSchema(BaseModel):
    id: str
    number: str
    maxPoints: float


class TestCreate(BaseModel):
    title: str
    date: str | None = None
    maxPoints: float = 0
    facitMode: str = "none"
    customParams: str | None = None
    questions: list[QuestionSchema] = []
    status: str = "draft"


class TestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    klassId: str = Field(validation_alias="klass_id", serialization_alias="klassId")
    title: str
    date: str | None = None
    maxPoints: float = Field(validation_alias="max_points", serialization_alias="maxPoints")
    facitMode: str = Field(validation_alias="facit_mode", serialization_alias="facitMode")
    customParams: str | None = Field(default=None, validation_alias="custom_params", serialization_alias="customParams")
    questions: list[dict[str, Any]] = []
    status: str
    createdAt: datetime = Field(validation_alias="created_at", serialization_alias="createdAt")


class GradingStepSchema(BaseModel):
    id: str
    questionId: str | None = None
    label: str
    maxPoints: float
    earnedPoints: float
    status: str
    feedback: str | None = None
    studentWork: str | None = None
    correctAnswer: str | None = None


class GradingResultCreate(BaseModel):
    testId: str
    studentName: str
    studentId: str | None = None
    identificationMethod: str = "name_field"
    identificationConfidence: float = 1.0
    steps: list[GradingStepSchema]
    totalScore: float
    maxScore: float
    percentage: float
    grade: str | None = None
    feedback: str | None = None


class GradingResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    provId: str = Field(validation_alias="test_id", serialization_alias="provId")
    studentId: str | None = Field(default=None, validation_alias="student_id", serialization_alias="studentId")
    studentName: str = Field(validation_alias="student_name", serialization_alias="studentName")
    identificationMethod: str = Field(validation_alias="identification_method", serialization_alias="identificationMethod")
    identificationConfidence: float = Field(validation_alias="identification_confidence", serialization_alias="identificationConfidence")
    steps: list[dict[str, Any]] = []
    totalScore: float = Field(validation_alias="total_score", serialization_alias="totalScore")
    maxScore: float = Field(validation_alias="max_score", serialization_alias="maxScore")
    percentage: float
    grade: str | None = None
    feedback: str | None = None
    scannedAt: datetime = Field(validation_alias="scanned_at", serialization_alias="scannedAt")
    gradedAt: datetime | None = Field(default=None, validation_alias="graded_at", serialization_alias="gradedAt")


class AnswerKeyRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    testId: str = Field(validation_alias="test_id", serialization_alias="testId")
    items: list[AnswerKeyItem] = []
    source: str
    createdAt: datetime = Field(validation_alias="created_at", serialization_alias="createdAt")


class WolframVerifyRequest(BaseModel):
    student: str
    correct: str


class ClaudeAnalyzeRequest(BaseModel):
    """Ett provider-agnostiskt analysanrop. Fältet heter 'claude' i URL:en för
    att matcha den slutgiltiga arkitekturen — idag körs det via Gemini/Groq
    beroende på AI_PROVIDER, imorgon via Anthropic utan kodändring i frontend."""

    problem: str
    studentAnswer: str
    correctAnswer: str
    context: str | None = None


class ClaudeAnalyzeResponse(BaseModel):
    feedback: str
    isCorrect: bool
    confidence: float
    provider: str
