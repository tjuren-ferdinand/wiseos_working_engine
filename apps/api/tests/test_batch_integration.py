"""Batch pipeline integration test — end-to-end with a real PNG.

Verifies the full grade_batch flow: name extraction → vision provider →
math verification → feedback provider → StudentDocumentResult. No network.
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
    MathVerification,
    QuestionResult,
    WolframResult,
)
from app.services.batch_identification import IdentifiedName
from app.services.batch_pipeline import (
    UploadedFile,
    grade_batch,
)

PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000a49444154789c63000100000500010d0a2db40000"
    "000049454e44ae426082"
)


async def test_batch_end_to_end():
    """Complete pipeline: name extraction → vision → math → feedback → result."""
    questions = [
        QuestionResult(
            questionNumber="1",
            found=True,
            studentWork="x = 2",
            assessment=Assessment(status="partial", points=0.5, maxPoints=2.0),
            correctAnswer="x = 2",
            feedback="Bra jobbat!",
            feedbackProvider="gemini-vision",
            mathVerification=MathVerification(
                provider="wolfram", status="verified",
                isEquivalent=True, confidence=0.99,
            ),
        ),
    ]
    meta = DocumentMeta(pageCount=1, model="test", questionsExpected=1)

    with patch("app.services.batch_pipeline.get_vision_provider") as mock_vision:
        mock_adapter = AsyncMock()
        mock_adapter.analyze_document = AsyncMock(return_value=(questions, meta))
        mock_adapter.name = "test-vision"
        mock_vision.return_value = mock_adapter

        with patch("app.services.batch_pipeline.get_math_provider") as mock_math:
            mock_math_adapter = AsyncMock()
            mock_math_adapter.verify_equation = AsyncMock(
                return_value=WolframResult(is_correct=True, confidence=0.99)
            )
            mock_math_adapter.name = "test-math"
            mock_math.return_value = mock_math_adapter

            with patch("app.services.batch_pipeline.apply_feedback_provider", new_callable=AsyncMock):
                results = await grade_batch(
                    prov_id="test-prov",
                    answer_key=[AnswerKeyItem(
                        question_number="1",
                        question_text="Lös x + 1 = 3",
                        final_answer="x = 2",
                        max_points=2,
                    )],
                    class_grading_parameters="",
                    test_specific_parameters="",
                    files=[
                        UploadedFile(
                            filename="anna_andersson.png",
                            content=PNG_1PX,
                            content_type="image/png",
                        )
                    ],
                    identification_method="name_field",
                )

    assert len(results) == 1
    r = results[0]
    assert r.provId == "test-prov"
    assert r.studentName  # name resolved (from image or filename fallback)
    assert r.identificationConfidence >= 0.0  # always a float in [0, 1]
    assert r.identificationMethod in {"name_field", "filename", "unresolved"}
    assert len(r.scanPages) == 1
    assert r.scanPages[0].startswith("data:image/png;base64,")
    assert len(r.questions) == 1
    # Math verification upgrades partial→correct with full points when Wolfram
    # returns is_correct=True, confidence>=0.85, and the answer key has no
    # derivation_steps/reasoning_requirements/rubric.
    assert r.questions[0].assessment.status == "correct"
    assert r.questions[0].assessment.points == 2.0
    assert r.questions[0].assessment.maxPoints == 2.0
    assert r.questions[0].mathVerification.status == "verified"


async def test_batch_multiple_files_grouped():
    """Two pages from same student → one StudentDocumentResult."""
    questions = [
        QuestionResult(
            questionNumber="1",
            found=True,
            studentWork="svar",
            assessment=Assessment(status="correct", points=1.0, maxPoints=1.0),
        ),
    ]
    meta = DocumentMeta(pageCount=2, model="test", questionsExpected=1)

    with patch("app.services.batch_pipeline.get_vision_provider") as mock_vision:
        mock_adapter = AsyncMock()
        mock_adapter.analyze_document = AsyncMock(return_value=(questions, meta))
        mock_adapter.name = "test-vision"
        mock_vision.return_value = mock_adapter

        with patch("app.services.batch_pipeline.apply_math_verification", new_callable=AsyncMock):
            with patch("app.services.batch_pipeline.apply_feedback_provider", new_callable=AsyncMock):
                results = await grade_batch(
                    prov_id="test-prov",
                    answer_key=[AnswerKeyItem(question_number="1", question_text="Q", final_answer="A")],
                    class_grading_parameters="",
                    test_specific_parameters="",
                    files=[
                        UploadedFile(filename="anna_sida1.png", content=PNG_1PX, content_type="image/png"),
                        UploadedFile(filename="anna_sida2.png", content=PNG_1PX, content_type="image/png"),
                    ],
                    identification_method="name_field",
                )

    assert len(results) == 1
    assert len(results[0].scanPages) == 2
    assert results[0].document.pageCount == 2


async def test_batch_name_field_identification_merges_pdf_pages():
    """Pages from same PDF with same identified name are merged."""
    questions = [
        QuestionResult(
            questionNumber="1",
            found=True,
            studentWork="svar",
            assessment=Assessment(status="correct", points=1.0, maxPoints=1.0),
        ),
    ]
    meta = DocumentMeta(pageCount=2, model="test", questionsExpected=1)

    with patch("app.services.batch_pipeline.get_vision_provider") as mock_vision:
        mock_adapter = AsyncMock()
        mock_adapter.analyze_document = AsyncMock(return_value=(questions, meta))
        mock_adapter.name = "test-vision"
        mock_vision.return_value = mock_adapter

        with patch("app.services.batch_pipeline.apply_math_verification", new_callable=AsyncMock):
            with patch("app.services.batch_pipeline.apply_feedback_provider", new_callable=AsyncMock):
                # Mock name extraction so both pages identify as same student
                with patch(
                    "app.services.batch_pipeline.extract_student_name",
                    new_callable=AsyncMock,
                    return_value=IdentifiedName(studentName="Anna Andersson", confidence=0.95, method="name_field"),
                ):
                    # Simulate a PDF expanded into 2 pages with source_id
                    files = [
                        UploadedFile(
                            filename="anna_andersson_sida_1.png",
                            content=PNG_1PX,
                            content_type="image/png",
                            source_id="anna_andersson.pdf",
                            page_number=1,
                        ),
                        UploadedFile(
                            filename="anna_andersson_sida_2.png",
                            content=PNG_1PX,
                            content_type="image/png",
                            source_id="anna_andersson.pdf",
                            page_number=2,
                        ),
                    ]
                    results = await grade_batch(
                        prov_id="test-prov",
                        answer_key=[AnswerKeyItem(question_number="1", question_text="Q", final_answer="A")],
                        class_grading_parameters="",
                        test_specific_parameters="",
                        files=files,
                        identification_method="name_field",
                    )

    assert len(results) == 1
    assert len(results[0].scanPages) == 2
