import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, JSON, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    """Användarkonto för autentisering."""
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    teacher: Mapped["Teacher | None"] = relationship(back_populates="user", uselist=False)


class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, unique=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    school_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    subscription_tier: Mapped[str] = mapped_column(String(50), default="trial")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User | None] = relationship(back_populates="teacher")
    assignments: Mapped[list["Assignment"]] = relationship(back_populates="teacher")


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    teacher_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("teachers.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str | None] = mapped_column(String(100), nullable=True)
    grade_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    problem_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    correct_answer: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    teacher: Mapped[Teacher | None] = relationship(back_populates="assignments")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="assignment", cascade="all, delete-orphan")


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    assignment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assignments.id"))
    student_name: Mapped[str] = mapped_column(String(255))
    answer_text: Mapped[str] = mapped_column(Text)
    student_pseudonym: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    score: Mapped[int] = mapped_column(Integer, default=0)
    ai_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    wolfram_verification: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    graded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Villkorad Automatisering – konfidens & granskningsworkflow
    ocr_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    wolfram_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence_overall: Mapped[float | None] = mapped_column(Float, nullable=True)
    requires_review: Mapped[bool] = mapped_column(Boolean, default=False)
    # 'auto_approved' | 'pending_review' | 'approved' | 'edited' | 'rejected'
    review_status: Mapped[str] = mapped_column(String(32), default="auto_approved")
    reviewed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    final_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_score: Mapped[int | None] = mapped_column(Integer, nullable=True)

    assignment: Mapped[Assignment] = relationship(back_populates="submissions")


# ============================================================================
# V2 MODELS – Kurs → Klass → Prov(Test) → Resultat
# Speglar frontendens lib/store.ts (Kurs/Klass/Prov/StudentResult) och
# persisterar det som tidigare bara låg i Zustand-minnet.
# ============================================================================


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    teacher_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(100))
    subject: Mapped[str] = mapped_column(String(100))
    level: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(Text)
    grade_thresholds: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Klass(Base):
    """En klass/grupp av elever knuten till en katalogkurs eller en ägarbunden egen kurs."""

    __tablename__ = "classes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    # Supabase auth-user-id (SupabaseUser.id) för läraren som äger klassen.
    # Nullable för bakåtkompatibilitet med rader skapade innan ägandeskap
    # infördes – sådana rader blir osynliga för alla lärare (GDPR-sprint v1).
    teacher_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    kurs_id: Mapped[str] = mapped_column(String(100), index=True)
    grading_params: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    grade_thresholds: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    students: Mapped[list["KlassStudent"]] = relationship(
        back_populates="klass", cascade="all, delete-orphan"
    )
    tests: Mapped[list["Test"]] = relationship(
        back_populates="klass", cascade="all, delete-orphan"
    )


class KlassStudent(Base):
    __tablename__ = "students"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    klass_id: Mapped[str] = mapped_column(String(36), ForeignKey("classes.id"))
    name: Mapped[str] = mapped_column(String(255))
    identifier: Mapped[str | None] = mapped_column(String(100), nullable=True)

    klass: Mapped[Klass] = relationship(back_populates="students")


class Test(Base):
    """Motsvarar frontendens `Prov`."""

    __tablename__ = "tests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    klass_id: Mapped[str] = mapped_column(String(36), ForeignKey("classes.id"))
    title: Mapped[str] = mapped_column(String(255))
    date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    max_points: Mapped[float] = mapped_column(Float, default=0.0)
    facit_mode: Mapped[str] = mapped_column(String(32), default="none")
    custom_params: Mapped[str | None] = mapped_column(Text, nullable=True)
    questions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    klass: Mapped[Klass] = relationship(back_populates="tests")
    grading_results: Mapped[list["GradingResult"]] = relationship(
        back_populates="test", cascade="all, delete-orphan"
    )
    answer_key: Mapped["AnswerKeyRecord | None"] = relationship(
        back_populates="test", uselist=False, cascade="all, delete-orphan"
    )


class GradingResult(Base):
    """Motsvarar frontendens `StudentResult` (inkl. steg som JSON)."""

    __tablename__ = "grading_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    test_id: Mapped[str] = mapped_column(String(36), ForeignKey("tests.id"), index=True)
    student_name: Mapped[str] = mapped_column(String(255))
    # KNOWN-ISSUE: ondelete="SET NULL" is declared here but NOT enforced at the DB
    # level on existing SQLite databases. The FK constraint was never created because
    # the column was added via ad-hoc ALTER TABLE (SQLite cannot add FK constraints
    # via ALTER). On fresh databases (create_all or Alembic baseline), the FK IS
    # created correctly.
    #
    # Additionally, routers/classes.py:delete_student explicitly HARD-DELETES
    # GradingResult rows when a student is deleted, rather than relying on
    # SET NULL cascade. This is semantically incompatible with ondelete="SET NULL"
    # — the app code wins (runs first), but the schema declaration is misleading.
    #
    # DO NOT add the FK constraint to existing SQLite databases without first
    # reconciling classes.py:delete_student to use SET NULL semantics.
    # See plan-3766349cb86fba8f.md "student_id FK conflict analysis" for details.
    student_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True)
    identification_method: Mapped[str] = mapped_column(String(32), default="name_field")
    identification_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    scan_pages: Mapped[list] = mapped_column(JSON, default=list)
    document: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    steps: Mapped[list] = mapped_column(JSON, default=list)
    total_score: Mapped[float] = mapped_column(Float, default=0.0)
    max_score: Mapped[float] = mapped_column(Float, default=0.0)
    percentage: Mapped[float] = mapped_column(Float, default=0.0)
    grade: Mapped[str | None] = mapped_column(String(4), nullable=True)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    scanned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    graded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # GDPR-sprint v1 (Vecka 2): sätts när retention-sweepen pseudonymiserat
    # student_name/student_id på denna rad. NULL = ännu inte anonymiserad.
    anonymized_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    test: Mapped[Test] = relationship(back_populates="grading_results")


class AnswerKeyRecord(Base):
    """Sparat facit per test – slipper generera/OCR:a om igen vid omrättning."""

    __tablename__ = "answer_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    test_id: Mapped[str] = mapped_column(String(36), ForeignKey("tests.id"), unique=True)
    items: Mapped[list] = mapped_column(JSON, default=list)
    source: Mapped[str] = mapped_column(String(32), default="generated")  # 'uploaded' | 'generated'
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    test: Mapped[Test] = relationship(back_populates="answer_key")
