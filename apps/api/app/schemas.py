from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator


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


class OcrRequest(BaseModel):
    image_base64: str


class OcrResponse(BaseModel):
    latex: str
    text: str
    confidence: float
    provider: str
    status: Literal["completed", "degraded"] = "completed"


class AnswerKeyItem(BaseModel):
    question_number: str
    question_text: str = ""
    final_answer: str
    acceptable_answers: list[str] = []
    derivation_steps: list[str] = []
    important_concepts: list[str] = []
    reasoning_requirements: list[str] = []
    mathematical_verification: bool | None = None
    max_points: float = 1.0
    # Valfri poängmatris, t.ex. {"2": "Fullständig härledning + rätt svar",
    # "1": "Rätt metod men räknefel", "0": "Fel metod"}.
    # Saknas den bedömer modellen mot final_answer/derivation_steps och
    # sänker sin confidence.
    rubric: dict[str, str] = {}


# ---------------------------------------------------------------------------
# Batch grading – speglar frontendens StudentResult/GradingStep i lib/store.ts
# ---------------------------------------------------------------------------


class SourceRegion(BaseModel):
    """Normaliserat område [0,1] i en specifik sida som elevens svar kommer ifrån.

    En uppgift kan ha flera regioner: dels när svaret fortsätter på nästa sida,
    dels när eleven skrivit på flera ställen på samma sida.
    """

    page: int = 1
    x: float = 0.0
    y: float = 0.0
    width: float = 0.0
    height: float = 0.0


# Bedömningsstatus. "needs_review" = AI:n har otillräckligt underlag och
# överlämnar till människa. Aldrig ett sätt att dölja ett tekniskt fel.
GradingStatus = Literal["correct", "partial", "incorrect", "needs_review"]


class Annotation(BaseModel):
    """Strukturerad AI-annotering som UI:t renderar som ✓/✗-punkter.

    Varje punkt ska referera till något som faktiskt syns i elevens arbete.
    """

    summary: str = ""
    evidence: list[str] = []      # ✓ det eleven bevisligen gjort rätt
    issues: list[str] = []        # ✗ konkreta fel i elevens arbete
    suggestions: list[str] = []   # nästa steg för eleven


class Assessment(BaseModel):
    status: GradingStatus = "needs_review"
    points: float = 0.0
    maxPoints: float = 1.0
    confidence: float = 0.0


class MathVerification(BaseModel):
    provider: str = "none"
    status: Literal["not_applicable", "verified", "not_equivalent", "degraded", "unavailable", "failed"] = "not_applicable"
    isEquivalent: bool | None = None
    confidence: float = 0.0
    message: str = ""


class QuestionResult(BaseModel):
    """Kanoniskt per-uppgift-resultat. Ämnesagnostiskt."""

    questionNumber: str
    # found=False betyder att uppgiften inte finns i dokumentet.
    # Oläslig handstil ger found=True + låg transcriptionConfidence + needs_review.
    found: bool = False
    # False när uppgiften hittades i bilden men saknas i facit.
    inAnswerKey: bool = True
    questionText: str = ""
    studentWork: str = ""
    transcriptionConfidence: float = 0.0
    correctAnswer: str = ""
    assessment: Assessment = Assessment()
    feedback: str = ""
    annotation: Annotation = Annotation()
    sourceRegions: list[SourceRegion] = []
    mathVerification: MathVerification = MathVerification()
    feedbackProvider: str = "vision-analysis"
    # Sätts när ett tekniskt fel hindrade bedömning (aldrig maskerat som "fel svar").
    error: str | None = None

    # --- Lärarens override, bevaras genom hela kedjan ---
    pointsTeacher: float | None = None
    teacherComment: str | None = None
    reviewStatus: str = "ai_suggested"
    # --- AI verdict exposed to frontend. "error" means technical/API failure.
    aiVerdict: str = ""
    # --- Human-readable summary/annotation shown to the teacher.
    baseAnnotation: str = ""


class DocumentMeta(BaseModel):
    """Diagnostik per elevdokument – driver logging och UI:ts osäkerhetsmarkörer."""

    pageCount: int = 0
    model: str = ""
    latencyMs: int = 0
    attempts: int = 1
    questionsExpected: int = 0
    questionsFound: int = 0
    needsReviewCount: int = 0
    # Extraherat elevnamn från bilden (t.ex. "Name: Erik Johansson") när name_field används.
    studentName: str | None = None
    # Sätts om HELA dokumentanalysen fallerade tekniskt.
    error: str | None = None
    # Dokumentverdict från sidklassificeringen: "student_submission" (normalt),
    # "not_student_submission" (blankett/facit — rättades aldrig) eller
    # "unverified" (klassificering saknade signal — rättades men obekräftat).
    documentType: str = "student_submission"
    classificationReason: str = ""
    # "uploaded" | "generated" | "inferred_question_sheet" | "none".
    # Visas för läraren så AI-infererat underlag aldrig förväxlas med facit.
    answerKeySource: str = "none"


class StudentDocumentResult(BaseModel):
    id: str
    provId: str
    studentName: str
    studentId: str | None = None
    identificationMethod: str = "unresolved"
    identificationConfidence: float = 0.0
    scanPages: list[str] = []   # data-URL per sida, i sidordning
    sourceFiles: list[str] = [] # ursprungsfilnamn per sida (för UI-mappning)
    document: DocumentMeta = DocumentMeta()
    questions: list[QuestionResult] = []


class BatchGradeResponse(BaseModel):
    provId: str
    results: list[StudentDocumentResult]
    activeRules: list[str] = []
    totalStudents: int
    totalQuestions: int
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
    A: float = Field(default=90, ge=0, le=100, allow_inf_nan=False)
    B: float = Field(default=80, ge=0, le=100, allow_inf_nan=False)
    C: float = Field(default=65, ge=0, le=100, allow_inf_nan=False)
    D: float = Field(default=50, ge=0, le=100, allow_inf_nan=False)
    E: float = Field(default=35, ge=0, le=100, allow_inf_nan=False)
    F: float = Field(default=0, ge=0, le=100, allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_order(self):
        if not self.A >= self.B >= self.C >= self.D >= self.E >= self.F:
            raise ValueError("Grade thresholds must satisfy A >= B >= C >= D >= E >= F")
        return self


class CourseCreate(BaseModel):
    name: str
    code: str
    subject: str
    level: str | None = None
    description: str
    gradeThresholds: GradeThresholdsSchema


class CourseUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    subject: str | None = None
    level: str | None = None
    description: str | None = None
    gradeThresholds: GradeThresholdsSchema | None = None


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    teacher_id: str
    name: str
    code: str
    subject: str
    level: str | None = None
    description: str
    gradeThresholds: dict[str, Any] = Field(validation_alias="grade_thresholds", serialization_alias="gradeThresholds")
    createdAt: datetime = Field(validation_alias="created_at", serialization_alias="createdAt")


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


class ClassUpdate(BaseModel):
    name: str | None = None
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


class TestUpdate(BaseModel):
    title: str | None = None
    date: str | None = None
    maxPoints: float | None = None
    facitMode: str | None = None
    customParams: str | None = None
    questions: list[QuestionSchema] | None = None
    status: str | None = None


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
    questionText: str | None = None
    maxPoints: float
    earnedPoints: float
    status: str
    feedback: str | None = None
    studentWork: str | None = None
    correctAnswer: str | None = None
    found: bool | None = None
    transcriptionConfidence: float | None = None
    annotation: Annotation | None = None
    error: str | None = None
    outsideAnswerKey: bool = False
    sourceRegions: list[SourceRegion] = []
    mathVerification: MathVerification | None = None
    feedbackProvider: str | None = None


class GradingResultCreate(BaseModel):
    testId: str
    studentName: str
    studentId: str | None = None
    identificationMethod: str = "unresolved"
    identificationConfidence: float = 0.0
    scanPages: list[str] = []
    document: DocumentMeta | None = None
    steps: list[GradingStepSchema]
    totalScore: float
    maxScore: float
    percentage: float
    grade: str | None = None
    feedback: str | None = None


class GradingResultUpdate(BaseModel):
    steps: list[GradingStepSchema] | None = None
    totalScore: float | None = None
    maxScore: float | None = None
    percentage: float | None = None
    grade: str | None = None
    feedback: str | None = None


class GradingResultListItem(BaseModel):
    """Lightweight list-item — inga scanPages (hämtas via GET /{result_id}).

    Base64-data-URL:er för sidbilder är tunga (MB per rad) och behövs inte i
    listvyn. Detalj-endpointen returnerar GradingResultOut med scanPages.
    """
    model_config = ConfigDict(from_attributes=True)

    id: str
    provId: str = Field(validation_alias="test_id", serialization_alias="provId")
    studentId: str | None = Field(default=None, validation_alias="student_id", serialization_alias="studentId")
    studentName: str = Field(validation_alias="student_name", serialization_alias="studentName")
    identificationMethod: str = Field(validation_alias="identification_method", serialization_alias="identificationMethod")
    identificationConfidence: float = Field(validation_alias="identification_confidence", serialization_alias="identificationConfidence")
    document: dict[str, Any] | None = None
    steps: list[dict[str, Any]] = []
    totalScore: float = Field(validation_alias="total_score", serialization_alias="totalScore")
    maxScore: float = Field(validation_alias="max_score", serialization_alias="maxScore")
    percentage: float
    grade: str | None = None
    feedback: str | None = None
    scannedAt: datetime = Field(validation_alias="scanned_at", serialization_alias="scannedAt")
    gradedAt: datetime | None = Field(default=None, validation_alias="graded_at", serialization_alias="gradedAt")


class GradingResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    provId: str = Field(validation_alias="test_id", serialization_alias="provId")
    studentId: str | None = Field(default=None, validation_alias="student_id", serialization_alias="studentId")
    studentName: str = Field(validation_alias="student_name", serialization_alias="studentName")
    identificationMethod: str = Field(validation_alias="identification_method", serialization_alias="identificationMethod")
    identificationConfidence: float = Field(validation_alias="identification_confidence", serialization_alias="identificationConfidence")
    scanPages: list[str] = Field(default=[], validation_alias="scan_pages", serialization_alias="scanPages")
    document: dict[str, Any] | None = None
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


# ---------------------------------------------------------------------------
# Allowlist — lärare som får använda appen (Spår 3.2)
# ---------------------------------------------------------------------------


class AllowlistAdd(BaseModel):
    email: str


class AllowedTeacherOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    supabaseUserId: str | None = Field(
        default=None, validation_alias="supabase_user_id", serialization_alias="supabaseUserId"
    )
    createdAt: datetime = Field(validation_alias="created_at", serialization_alias="createdAt")
    createdBy: str | None = Field(
        default=None, validation_alias="created_by", serialization_alias="createdBy"
    )
