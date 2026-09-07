"""Score calculation and aggregation tests.

Verifies that points, percentages, and needs_review counts are computed
correctly — no network required.
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.schemas import (
    AnswerKeyItem,
    Assessment,
    DocumentMeta,
    QuestionResult,
)
from app.services.batch_pipeline import (
    UploadedFile,
    apply_math_verification,
    grade_batch,
    requires_math_verification,
)

PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000a49444154789c63000100000500010d0a2db40000"
    "000049454e44ae426082"
)


def _make_answer_key(numbers: list[str], max_points: float = 1.0) -> list[AnswerKeyItem]:
    return [
        AnswerKeyItem(
            question_number=n,
            question_text=f"Fråga {n}",
            final_answer=f"Svar {n}",
            max_points=max_points,
        )
        for n in numbers
    ]


def _question(number: str, status: str, points: float, max_points: float) -> QuestionResult:
    return QuestionResult(
        questionNumber=number,
        found=True,
        studentWork="svar",
        assessment=Assessment(status=status, points=points, maxPoints=max_points),
    )


# ---------------------------------------------------------------------------
# requires_math_verification
# ---------------------------------------------------------------------------


def test_requires_math_verification_explicit_true():
    item = AnswerKeyItem(
        question_number="1", question_text="Q", final_answer="A",
        mathematical_verification=True,
    )
    assert requires_math_verification(item)


def test_requires_math_verification_explicit_false():
    item = AnswerKeyItem(
        question_number="1", question_text="Q", final_answer="A",
        mathematical_verification=False,
    )
    assert not requires_math_verification(item)


def test_requires_math_verification_math_notation():
    item = AnswerKeyItem(
        question_number="1", question_text="Beräkna \\frac{1}{2}",
        final_answer="0.5",
    )
    assert requires_math_verification(item)


def test_requires_math_verification_math_terms():
    item = AnswerKeyItem(
        question_number="1", question_text="Lös ekvationen",
        final_answer="x = 3",
    )
    assert requires_math_verification(item)


def test_requires_math_verification_non_math():
    item = AnswerKeyItem(
        question_number="1", question_text="Sveriges huvudstad?",
        final_answer="Stockholm",
    )
    assert not requires_math_verification(item)


# ---------------------------------------------------------------------------
# apply_math_verification — verified → status/points update
# ---------------------------------------------------------------------------


async def test_apply_math_verification_verified_marks_correct():
    """When Wolfram verifies equivalence, status becomes 'correct' and points = max."""
    item = AnswerKeyItem(
        question_number="1", question_text="Lös x + 1 = 3",
        final_answer="x = 2", mathematical_verification=True,
    )
    question = _question("1", "partial", 0.5, 2.0)

    class FakeVerifier:
        async def verify_equation(self, a, b):
            from app.schemas import WolframResult
            return WolframResult(is_correct=True, confidence=0.99)

    from unittest.mock import patch
    with patch("app.services.batch_pipeline.get_math_provider", return_value=FakeVerifier()):
        with patch("app.services.batch_pipeline.settings") as mock_settings:
            mock_settings.WOLFRAM_APP_ID = "configured"
            mock_settings.WOLFRAM_API_URL = ""
            await apply_math_verification([question], [item])

    assert question.mathVerification.status == "verified"
    assert question.assessment.status == "correct"
    assert question.assessment.points == 2.0


async def test_apply_math_verification_not_equivalent_resets_correct():
    """When Wolfram says not equivalent, 'correct' → 'needs_review' with 0 points."""
    item = AnswerKeyItem(
        question_number="1", question_text="Lös x + 1 = 3",
        final_answer="x = 2", mathematical_verification=True,
    )
    question = _question("1", "correct", 2.0, 2.0)

    class FakeVerifier:
        async def verify_equation(self, a, b):
            from app.schemas import WolframResult
            return WolframResult(is_correct=False, confidence=0.99)

    with patch("app.services.batch_pipeline.get_math_provider", return_value=FakeVerifier()):
        with patch("app.services.batch_pipeline.settings") as mock_settings:
            mock_settings.WOLFRAM_APP_ID = "configured"
            mock_settings.WOLFRAM_API_URL = ""
            await apply_math_verification([question], [item])

    assert question.mathVerification.status == "not_equivalent"
    assert question.assessment.status == "needs_review"
    assert question.assessment.points == 0.0


async def test_apply_math_verification_skips_not_found():
    """Questions with found=False get mathVerification.status='unavailable'."""
    item = AnswerKeyItem(
        question_number="1", question_text="Lös x + 1 = 3",
        final_answer="x = 2", mathematical_verification=True,
    )
    question = QuestionResult(
        questionNumber="1",
        found=False,
        studentWork="",
        assessment=Assessment(status="needs_review", points=0.0, maxPoints=2.0),
    )

    await apply_math_verification([question], [item])

    assert question.mathVerification.status == "unavailable"
    assert "läsbart elevsvar" in question.mathVerification.message


async def test_apply_math_verification_low_confidence_degraded():
    """Wolfram confidence < 0.85 → status 'degraded', no auto-correct."""
    item = AnswerKeyItem(
        question_number="1", question_text="Lös x + 1 = 3",
        final_answer="x = 2", mathematical_verification=True,
    )
    question = _question("1", "partial", 0.5, 2.0)

    class FakeVerifier:
        async def verify_equation(self, a, b):
            from app.schemas import WolframResult
            return WolframResult(is_correct=True, confidence=0.5)

    with patch("app.services.batch_pipeline.get_math_provider", return_value=FakeVerifier()):
        with patch("app.services.batch_pipeline.settings") as mock_settings:
            mock_settings.WOLFRAM_APP_ID = "configured"
            mock_settings.WOLFRAM_API_URL = ""
            await apply_math_verification([question], [item])

    assert question.mathVerification.status == "degraded"
    assert question.assessment.status == "partial"  # unchanged
    assert question.assessment.points == 0.5  # unchanged


async def test_apply_math_verification_no_config_uses_local():
    """Without Wolfram keys, math verification uses local comparison (degraded)."""
    item = AnswerKeyItem(
        question_number="1", question_text="Lös x + 1 = 3",
        final_answer="x = 2", mathematical_verification=True,
    )
    question = _question("1", "partial", 0.5, 2.0)

    class FakeVerifier:
        async def verify_equation(self, a, b):
            from app.schemas import WolframResult
            return WolframResult(is_correct=True, confidence=0.85)

    with patch("app.services.batch_pipeline.get_math_provider", return_value=FakeVerifier()):
        with patch("app.services.batch_pipeline.settings") as mock_settings:
            mock_settings.WOLFRAM_APP_ID = ""
            mock_settings.WOLFRAM_API_URL = ""
            await apply_math_verification([question], [item])

    assert question.mathVerification.status == "degraded"
    assert "lokal" in question.mathVerification.message.lower()


# ---------------------------------------------------------------------------
# grade_batch — score aggregation
# ---------------------------------------------------------------------------


async def test_grade_batch_aggregates_scores():
    """Full pipeline: verify points and max_points flow through correctly."""
    questions = [
        _question("1", "correct", 2.0, 2.0),
        _question("2", "partial", 0.5, 2.0),
        _question("3", "incorrect", 0.0, 1.0),
    ]
    meta = DocumentMeta(pageCount=1, model="test", questionsExpected=3)

    with patch("app.services.batch_pipeline.get_vision_provider") as mock_get:
        mock_adapter = AsyncMock()
        mock_adapter.analyze_document = AsyncMock(return_value=(questions, meta))
        mock_adapter.name = "test"
        mock_get.return_value = mock_adapter

        with patch("app.services.batch_pipeline.apply_math_verification", new_callable=AsyncMock):
            with patch("app.services.batch_pipeline.apply_feedback_provider", new_callable=AsyncMock):
                results = await grade_batch(
                    prov_id="test",
                    answer_key=_make_answer_key(["1", "2", "3"]),
                    class_grading_parameters="",
                    test_specific_parameters="",
                    files=[UploadedFile(filename="anna.png", content=PNG_1PX, content_type="image/png")],
                    identification_method="name_field",
                )

    assert len(results) == 1
    r = results[0]
    total_earned = sum(q.assessment.points for q in r.questions)
    total_max = sum(q.assessment.maxPoints for q in r.questions)
    assert total_earned == 2.5
    assert total_max == 5.0


async def test_grade_batch_no_answer_key_returns_empty():
    """Without an answer key, questions list is empty."""
    meta = DocumentMeta(pageCount=1, model="test", questionsExpected=0)

    with patch("app.services.batch_pipeline.get_vision_provider") as mock_get:
        mock_adapter = AsyncMock()
        mock_adapter.analyze_document = AsyncMock(return_value=([], meta))
        mock_adapter.name = "test"
        mock_get.return_value = mock_adapter

        with patch("app.services.batch_pipeline.apply_math_verification", new_callable=AsyncMock):
            with patch("app.services.batch_pipeline.apply_feedback_provider", new_callable=AsyncMock):
                results = await grade_batch(
                    prov_id="test",
                    answer_key=[],
                    class_grading_parameters="",
                    test_specific_parameters="",
                    files=[UploadedFile(filename="anna.png", content=PNG_1PX, content_type="image/png")],
                    identification_method="name_field",
                )

    assert len(results) == 1
    assert results[0].questions == []
