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
    identify_and_group_pages,
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
                # Utan WOLFRAM_APP_ID/API_URL markeras verifieringen "degraded"
                # och uppgraderar aldrig till "correct" — sätt en fake-config
                # direkt på settings-singletonen (övriga attribut behålls).
                import app.services.batch_pipeline as bp
                with patch.object(bp.settings, "WOLFRAM_APP_ID", "TEST-APP-ID"):
                    with patch(
                        "app.services.batch_pipeline.extract_student_name",
                        new_callable=AsyncMock,
                        # pageType="student_work" krävs — annars klassas
                        # dokumentet som not_student_submission och rättas
                        # aldrig (alla frågor blir needs_review).
                        return_value=IdentifiedName(
                            studentName="Anna Andersson", confidence=0.95,
                            method="name_field", pageType="student_work",
                        ),
                    ):
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


async def test_single_name_page_anchors_whole_pdf():
    """Realistic single-student PDF: name field only on page 1, remaining
    pages unnamed → must still produce ONE document with all pages.

    Regression test for the bug where an 18-page PDF exploded into 18
    separate student cards because only page 1 carried a readable name.
    """
    questions = [
        QuestionResult(
            questionNumber="1",
            found=True,
            studentWork="svar",
            assessment=Assessment(status="correct", points=1.0, maxPoints=1.0),
        ),
    ]
    meta = DocumentMeta(pageCount=3, model="test", questionsExpected=1)

    named = IdentifiedName(studentName="Henrik Test", confidence=0.95, method="name_field")
    unnamed = IdentifiedName(studentName=None, confidence=0.0, method="name_field_empty")

    with patch("app.services.batch_pipeline.get_vision_provider") as mock_vision:
        mock_adapter = AsyncMock()
        mock_adapter.analyze_document = AsyncMock(return_value=(questions, meta))
        mock_adapter.name = "test-vision"
        mock_vision.return_value = mock_adapter

        with patch("app.services.batch_pipeline.apply_math_verification", new_callable=AsyncMock):
            with patch("app.services.batch_pipeline.apply_feedback_provider", new_callable=AsyncMock):
                with patch(
                    "app.services.batch_pipeline.extract_student_name",
                    new_callable=AsyncMock,
                    side_effect=[named, unnamed, unnamed],
                ):
                    files = [
                        UploadedFile(
                            filename=f"henrik_test_sida_{n}.png",
                            content=PNG_1PX,
                            content_type="image/png",
                            source_id="henrik_test.pdf",
                            page_number=n,
                        )
                        for n in (1, 2, 3)
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
    assert results[0].studentName == "Henrik Test"
    assert results[0].identificationMethod == "name_field"
    assert len(results[0].scanPages) == 3


async def test_unreadable_first_page_never_merges_different_student():
    """Class-bundle PDF: page 1 name unreadable, page 2 reads a DIFFERENT
    student name → the two must stay as separate documents.

    Safety invariant: a page without a confidently read name may attach as a
    continuation page, but a confidently read DIFFERENT name always opens a
    new student document — low confidence must never merge students.
    """
    questions = [
        QuestionResult(
            questionNumber="1",
            found=True,
            studentWork="svar",
            assessment=Assessment(status="correct", points=1.0, maxPoints=1.0),
        ),
    ]
    meta = DocumentMeta(pageCount=1, model="test", questionsExpected=1)

    unnamed = IdentifiedName(studentName=None, confidence=0.0, method="name_field_empty")
    boris = IdentifiedName(studentName="Boris Berg", confidence=0.95, method="name_field")

    with patch("app.services.batch_pipeline.get_vision_provider") as mock_vision:
        mock_adapter = AsyncMock()
        mock_adapter.analyze_document = AsyncMock(return_value=(questions, meta))
        mock_adapter.name = "test-vision"
        mock_vision.return_value = mock_adapter

        with patch("app.services.batch_pipeline.apply_math_verification", new_callable=AsyncMock):
            with patch("app.services.batch_pipeline.apply_feedback_provider", new_callable=AsyncMock):
                with patch(
                    "app.services.batch_pipeline.extract_student_name",
                    new_callable=AsyncMock,
                    side_effect=[unnamed, boris, unnamed],
                ):
                    files = [
                        UploadedFile(
                            filename="bundle_sida_1.png",
                            content=PNG_1PX,
                            content_type="image/png",
                            source_id="bundle.pdf",
                            page_number=1,
                        ),
                        UploadedFile(
                            filename="bundle_sida_2.png",
                            content=PNG_1PX,
                            content_type="image/png",
                            source_id="bundle.pdf",
                            page_number=2,
                        ),
                        UploadedFile(
                            filename="bundle_sida_3.png",
                            content=PNG_1PX,
                            content_type="image/png",
                            source_id="bundle.pdf",
                            page_number=3,
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

    # Sida 1 får EGEN handling (unresolved) — den får inte slukas av Boris.
    # Sidorna 2-3 bildar Boris dokument (sida 3 är fortsättningssida).
    assert len(results) == 2
    assert results[0].studentName != "Boris Berg"
    assert results[0].identificationMethod in {"unresolved", "filename"}
    assert len(results[0].scanPages) == 1
    assert results[1].studentName == "Boris Berg"
    assert results[1].identificationMethod == "name_field"
    assert len(results[1].scanPages) == 2


async def test_scanner_group_boundary_blocks_positional_merge():
    """'Nästa elev'-gränser i skannade filnamn är hårda segmentgränser.

    Scenario: elev 1 (e01) får två sidor, elev 2 (e02) en sida vars namn
    inte kan läsas. Utan markören skulle e02-sidan absorberas som
    positionell fortsättning i Annas förankrade segment — med markören
    måste den ligga kvar som eget unresolved-dokument.
    """
    anna = IdentifiedName(studentName="Anna Ahl", confidence=0.95, method="name_field")
    unnamed = IdentifiedName(studentName=None, confidence=0.0, method="name_field_empty")

    files = [
        UploadedFile(filename="scan-abc-e01-01.jpg", content=PNG_1PX, content_type="image/jpeg"),
        UploadedFile(filename="scan-abc-e01-02.jpg", content=PNG_1PX, content_type="image/jpeg"),
        UploadedFile(filename="scan-abc-e02-01.jpg", content=PNG_1PX, content_type="image/jpeg"),
    ]
    with patch(
        "app.services.batch_pipeline.extract_student_name",
        new_callable=AsyncMock,
        side_effect=[anna, unnamed, unnamed],
    ):
        docs = await identify_and_group_pages(files)

    assert len(docs) == 2
    assert docs[0].student_name == "Anna Ahl"
    assert docs[0].identification_method == "name_field"
    assert len(docs[0].pages) == 2
    assert docs[1].identification_method == "unresolved"
    assert len(docs[1].pages) == 1


async def test_scanner_group_boundary_same_name_flagged_ambiguous():
    """Samma säkert lästa namn i två olika elevgrupper slås inte ihop —
    båda flaggas name_field_ambiguous så läraren granskar (feltryck på
    'Nästa elev' eller två elever med samma namn)."""
    anna = IdentifiedName(studentName="Anna Ahl", confidence=0.95, method="name_field")

    files = [
        UploadedFile(filename="scan-abc-e01-01.jpg", content=PNG_1PX, content_type="image/jpeg"),
        UploadedFile(filename="scan-abc-e02-01.jpg", content=PNG_1PX, content_type="image/jpeg"),
    ]
    with patch(
        "app.services.batch_pipeline.extract_student_name",
        new_callable=AsyncMock,
        side_effect=[anna, anna],
    ):
        docs = await identify_and_group_pages(files)

    assert len(docs) == 2
    assert all(d.student_name == "Anna Ahl" for d in docs)
    assert all(d.identification_method == "name_field_ambiguous" for d in docs)


async def test_scanner_facit_group_named_facit_and_not_submission():
    """Sidor från skannerns facit-fas (e00) namnsätts 'Facit/frågeblad'
    istället för 'Okänd elev', och klassificeras not_student_submission
    via befintlig pageType-logik — merge/klassificering är orörd."""
    facit = IdentifiedName(
        studentName=None, confidence=0.9, method="name_field",
        pageType="answer_key",
    )
    anna = IdentifiedName(
        studentName="Anna Ahl", confidence=0.95, method="name_field",
        pageType="student_work", hasHandwriting=True,
    )
    files = [
        UploadedFile(filename="scan-abc-e00-01.jpg", content=PNG_1PX, content_type="image/jpeg"),
        UploadedFile(filename="scan-abc-e01-01.jpg", content=PNG_1PX, content_type="image/jpeg"),
    ]
    with patch(
        "app.services.batch_pipeline.extract_student_name",
        new_callable=AsyncMock,
        side_effect=[facit, anna],
    ):
        docs = await identify_and_group_pages(files)

    assert len(docs) == 2
    assert docs[0].student_name == "Facit/frågeblad"
    assert docs[0].document_type == "not_student_submission"
    assert docs[1].student_name == "Anna Ahl"
    assert docs[1].document_type == "student_submission"
