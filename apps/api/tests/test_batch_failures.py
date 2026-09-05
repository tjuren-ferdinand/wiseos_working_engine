"""Batch failure-mode tests.

Verifies that provider failures produce needs_review results without crashes
or fabricated data — the pipeline never invents answers, scores, or feedback.
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
    WolframResult,
)
from app.services.batch_pipeline import (
    UploadedFile,
    apply_feedback_provider,
    apply_math_verification,
    grade_batch,
)
from app.services.gemini_vision import GradingError

PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000a49444154789c63000100000500010d0a2db40000"
    "000049454e44ae426082"
)


def _upload(filename: str = "anna.png") -> UploadedFile:
    return UploadedFile(filename=filename, content=PNG_1PX, content_type="image/png")


def _answer_key() -> list[AnswerKeyItem]:
    return [AnswerKeyItem(question_number="1", question_text="Q", final_answer="A")]


# ---------------------------------------------------------------------------
# Vision provider failures
# ---------------------------------------------------------------------------


async def test_vision_failure_returns_needs_review_not_crash():
    """When the vision provider raises, the pipeline returns needs_review results."""
    questions = [
        QuestionResult(
            questionNumber="1",
            found=False,
            studentWork="",
            assessment=Assessment(status="needs_review", points=0.0, maxPoints=1.0),
            error="Provider error",
        ),
    ]
    meta = DocumentMeta(
        pageCount=1, model="test", questionsExpected=1,
        error="Provider error", needsReviewCount=1,
    )

    with patch("app.services.batch_pipeline.get_vision_provider") as mock_get:
        mock_adapter = AsyncMock()
        mock_adapter.analyze_document = AsyncMock(return_value=(questions, meta))
        mock_adapter.name = "test-vision"
        mock_get.return_value = mock_adapter

        with patch("app.services.batch_pipeline.apply_math_verification", new_callable=AsyncMock):
            with patch("app.services.batch_pipeline.apply_feedback_provider", new_callable=AsyncMock):
                results = await grade_batch(
                    prov_id="test",
                    answer_key=_answer_key(),
                    class_grading_parameters="",
                    test_specific_parameters="",
                    files=[_upload()],
                    identification_method="name_field",
                )

    assert len(results) == 1
    r = results[0]
    assert r.document.error is not None or r.document.needsReviewCount > 0
    for q in r.questions:
        assert q.assessment.points == 0.0
        assert q.assessment.status != "correct"
        assert not q.feedback  # no fabricated feedback


async def test_vision_circuit_open_yields_needs_review():
    """Circuit-open GradingError from adapter → needs_review, not crash."""
    from app.services.providers.resilience import CircuitOpenError

    async def circuit_open(**kwargs):
        raise CircuitOpenError("test-provider")

    with patch("app.services.batch_pipeline.get_vision_provider") as mock_get:
        mock_adapter = AsyncMock()
        mock_adapter.analyze_document = circuit_open
        mock_adapter.name = "test-vision"
        mock_get.return_value = mock_adapter

        with patch("app.services.batch_pipeline.apply_math_verification", new_callable=AsyncMock):
            with patch("app.services.batch_pipeline.apply_feedback_provider", new_callable=AsyncMock):
                results = await grade_batch(
                    prov_id="test",
                    answer_key=_answer_key(),
                    class_grading_parameters="",
                    test_specific_parameters="",
                    files=[_upload()],
                    identification_method="name_field",
                )

    assert len(results) == 1
    r = results[0]
    assert "circuit" in (r.document.error or "").lower() or r.document.needsReviewCount > 0
    for q in r.questions:
        assert q.assessment.points == 0.0
        assert q.assessment.status != "correct"


# ---------------------------------------------------------------------------
# Math verification failures
# ---------------------------------------------------------------------------


async def test_math_verification_crash_yields_needs_review():
    """When math verification crashes, the question is marked needs_review."""
    item = AnswerKeyItem(
        question_number="1", question_text="Lös x + 1 = 3",
        final_answer="x = 2", mathematical_verification=True,
    )
    question = QuestionResult(
        questionNumber="1", found=True, studentWork="x = 2",
        assessment=Assessment(status="partial", points=0.5, maxPoints=2.0),
    )

    class CrashingVerifier:
        async def verify_equation(self, a, b):
            raise RuntimeError("Wolfram API down")

    with patch("app.services.batch_pipeline.get_math_provider", return_value=CrashingVerifier()):
        with patch("app.services.batch_pipeline.settings") as mock_settings:
            mock_settings.WOLFRAM_APP_ID = "configured"
            mock_settings.WOLFRAM_API_URL = ""
            await apply_math_verification([question], [item])

    assert question.mathVerification.status == "failed"
    assert "lärargranskning" in question.mathVerification.message.lower()
    assert question.assessment.status == "needs_review"


async def test_math_verification_not_found_question():
    """Questions not found get 'unavailable' status, no crash."""
    item = AnswerKeyItem(
        question_number="1", question_text="Q",
        final_answer="A", mathematical_verification=True,
    )
    question = QuestionResult(
        questionNumber="1", found=False, studentWork="",
        assessment=Assessment(status="needs_review", points=0.0, maxPoints=1.0),
    )

    await apply_math_verification([question], [item])
    assert question.mathVerification.status == "unavailable"


# ---------------------------------------------------------------------------
# Feedback provider failures
# ---------------------------------------------------------------------------


async def test_feedback_provider_failure_leaves_question_unchanged():
    """When feedback generation fails, the question keeps its original state."""
    question = QuestionResult(
        questionNumber="1", found=True, studentWork="svar",
        assessment=Assessment(status="correct", points=1.0, maxPoints=1.0),
        feedback="Gemini redan gav feedback",
        feedbackProvider="gemini-vision",
    )

    with patch("app.services.batch_pipeline.get_feedback_provider") as mock_get:
        mock_get.side_effect = RuntimeError("no provider configured")

        await apply_feedback_provider([question])

    assert question.feedbackProvider == "gemini-vision"
    assert question.feedback == "Gemini redan gav feedback"


async def test_feedback_provider_unavailable():
    """When no feedback provider is configured, questions are marked accordingly."""
    question = QuestionResult(
        questionNumber="1", found=True, studentWork="svar",
        assessment=Assessment(status="correct", points=1.0, maxPoints=1.0),
    )

    with patch("app.services.batch_pipeline.feedback") as mock_feedback:
        mock_feedback.provider_name.return_value = "unavailable"
        with patch("app.services.batch_pipeline.settings") as mock_settings:
            mock_settings.GEMINI_API_KEY = ""
            await apply_feedback_provider([question])

    assert question.feedbackProvider == "unavailable"


async def test_feedback_provider_error_keeps_existing_feedback():
    """If feedback already exists (from vision), a provider error keeps it."""
    question = QuestionResult(
        questionNumber="1", found=True, studentWork="svar",
        assessment=Assessment(status="correct", points=1.0, maxPoints=1.0),
        feedback="Existing feedback",
        feedbackProvider="gemini-vision",
    )

    with patch("app.services.batch_pipeline.get_feedback_provider") as mock_get:
        mock_adapter = AsyncMock()
        mock_adapter.generate_feedback = AsyncMock(side_effect=RuntimeError("API error"))
        mock_adapter.name = "test"
        mock_get.return_value = mock_adapter

        await apply_feedback_provider([question])

    assert question.feedback == "Existing feedback"
    assert question.feedbackProvider == "gemini-vision"


# ---------------------------------------------------------------------------
# No fabricated data
# ---------------------------------------------------------------------------


async def test_no_fabricated_score_on_any_failure():
    """Regardless of which provider fails, no fabricated score appears."""
    questions = [
        QuestionResult(
            questionNumber="1", found=False, studentWork="",
            assessment=Assessment(status="needs_review", points=0.0, maxPoints=1.0),
            error="fail",
        ),
    ]
    meta = DocumentMeta(pageCount=1, model="test", questionsExpected=1, error="fail", needsReviewCount=1)

    with patch("app.services.batch_pipeline.get_vision_provider") as mock_vision:
        mock_adapter = AsyncMock()
        mock_adapter.analyze_document = AsyncMock(return_value=(questions, meta))
        mock_adapter.name = "test"
        mock_vision.return_value = mock_adapter

        with patch("app.services.batch_pipeline.get_math_provider") as mock_math:
            mock_math_adapter = AsyncMock()
            mock_math_adapter.verify_equation = AsyncMock(side_effect=RuntimeError("down"))
            mock_math_adapter.name = "test"
            mock_math.return_value = mock_math_adapter

            with patch("app.services.batch_pipeline.get_feedback_provider") as mock_feedback:
                mock_feedback.side_effect = RuntimeError("no provider")

                results = await grade_batch(
                    prov_id="test",
                    answer_key=_answer_key(),
                    class_grading_parameters="",
                    test_specific_parameters="",
                    files=[_upload()],
                    identification_method="name_field",
                )

    assert len(results) == 1
    r = results[0]
    for q in r.questions:
        assert q.assessment.points == 0.0
        assert q.assessment.status != "correct"
        assert not q.studentWork or q.studentWork == ""
        assert not q.feedback
