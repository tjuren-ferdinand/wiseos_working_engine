"""Felfalls- och invariant-tester för rättningsmotorn.

Kör utan nätverk: Gemini-anropet mockas. Syftet är att bevisa att systemet
aldrig kraschar och aldrig fejkar ett resultat när något går fel.

    python -m pytest tests/test_failure_modes.py -v
"""
from __future__ import annotations

import json
from io import BytesIO

import httpx
import pytest
from pypdf import PdfWriter
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.db import Base
from app.routers.batch import _persist_batch
from app.schemas import Annotation, AnswerKeyItem, Assessment, DocumentMeta, QuestionResult, StudentDocumentResult, WolframResult
from app.services import batch_pipeline, feedback, gemini_vision
from app.services.batch_identification import IdentifiedName
from app.services.batch_pipeline import (
    UploadedFile,
    apply_math_verification,
    derive_student_name,
    expand_pdf_uploads,
    group_pages_by_student,
    identify_and_group_pages,
)

PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000a49444154789c63000100000500010d0a2db40000"
    "000049454e44ae426082"
)


def _item(number: str = "1", max_points: float = 2.0) -> AnswerKeyItem:
    return AnswerKeyItem(
        question_number=number,
        question_text="Vad är 2 + 2?",
        final_answer="4",
        derivation_steps=["2 + 2 = 4"],
        max_points=max_points,
    )


def _pages(count: int = 1) -> list[tuple[bytes, str]]:
    return [(PNG_1PX, "image/png") for _ in range(count)]


def _gemini_body(payload: dict) -> dict:
    return {"candidates": [{"content": {"parts": [{"text": json.dumps(payload)}]}}]}


def _valid_payload(number: str = "1") -> dict:
    return {
        "questions": [
            {
                "question_number": number,
                "found": True,
                "question_text": "Vad är 2 + 2?",
                "student_work": "2 + 2 = 4",
                "transcription_confidence": 0.95,
                "source_regions": [
                    {"page": 1, "x": 0.1, "y": 0.1, "width": 0.5, "height": 0.2}
                ],
                "status": "correct",
                "points": 2.0,
                "assessment_confidence": 0.95,
                "feedback": "Rätt.",
                "annotation_summary": "Korrekt beräkning.",
                "annotation_evidence": ["Eleven skriver 2 + 2 = 4"],
                "annotation_issues": [],
                "annotation_suggestions": [],
            }
        ],
        "unlisted_questions": [],
    }


class _MockClient:
    """Ersätter httpx.AsyncClient och spelar upp en sekvens av svar."""

    calls = 0
    responses: list = []

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, **kwargs):
        index = min(_MockClient.calls, len(_MockClient.responses) - 1)
        item = _MockClient.responses[index]
        _MockClient.calls += 1
        if isinstance(item, Exception):
            raise item
        status, body = item
        return httpx.Response(
            status_code=status,
            json=body if isinstance(body, dict) else None,
            text=None if isinstance(body, dict) else body,
            request=httpx.Request("POST", url),
        )


@pytest.fixture(autouse=True)
def _fast_and_configured(monkeypatch):
    """Ingen riktig backoff-väntan och en låtsasnyckel."""
    monkeypatch.setattr(gemini_vision.settings, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(gemini_vision.settings, "GEMINI_MODEL", "gemini-3.5-flash")

    async def _no_sleep(_seconds):
        return None

    monkeypatch.setattr(gemini_vision.asyncio, "sleep", _no_sleep)
    _MockClient.calls = 0
    _MockClient.responses = []


def _install(monkeypatch, responses: list) -> None:
    _MockClient.calls = 0
    _MockClient.responses = responses
    monkeypatch.setattr(gemini_vision.httpx, "AsyncClient", _MockClient)


# ---------------------------------------------------------------------------
# Transienta fel ska retryas och sedan lyckas
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_rate_limit_then_success(monkeypatch):
    _install(monkeypatch, [(429, "rate limited"), (200, _gemini_body(_valid_payload()))])
    questions, meta = await gemini_vision.analyze_document(
        pages=_pages(), answer_key=[_item()]
    )
    assert meta.error is None
    assert questions[0].assessment.status == "correct"
    assert _MockClient.calls == 2


@pytest.mark.asyncio
async def test_server_error_then_success(monkeypatch):
    _install(monkeypatch, [(503, "unavailable"), (200, _gemini_body(_valid_payload()))])
    questions, meta = await gemini_vision.analyze_document(
        pages=_pages(), answer_key=[_item()]
    )
    assert meta.error is None
    assert questions[0].found is True


@pytest.mark.asyncio
async def test_timeout_then_success(monkeypatch):
    _install(
        monkeypatch,
        [httpx.TimeoutException("timed out"), (200, _gemini_body(_valid_payload()))],
    )
    questions, meta = await gemini_vision.analyze_document(
        pages=_pages(), answer_key=[_item()]
    )
    assert meta.error is None
    assert questions[0].assessment.points == 2.0


@pytest.mark.asyncio
async def test_invalid_json_is_retried(monkeypatch):
    """Regression: trasig JSON tappade tidigare hela uppgiftsgruppen."""
    broken = {"candidates": [{"content": {"parts": [{"text": '{"questions": [ {,,, }'}]}}]}
    _install(monkeypatch, [(200, broken), (200, _gemini_body(_valid_payload()))])
    questions, meta = await gemini_vision.analyze_document(
        pages=_pages(), answer_key=[_item()]
    )
    assert meta.error is None
    assert questions[0].found is True
    assert _MockClient.calls == 2


@pytest.mark.asyncio
async def test_raw_newline_inside_string_is_repaired(monkeypatch):
    """Rå radbrytning i transkriptionen ska lagas, inte kasta bort svaret."""
    payload = _valid_payload()
    text = json.dumps(payload).replace("2 + 2 = 4", "rad1\nrad2")
    # Gör strängen ogiltig genom att stoppa in en riktig radbrytning.
    text = text.replace("rad1\\nrad2", "rad1\nrad2")
    _install(monkeypatch, [(200, {"candidates": [{"content": {"parts": [{"text": text}]}}]})])
    questions, meta = await gemini_vision.analyze_document(
        pages=_pages(), answer_key=[_item()]
    )
    assert meta.error is None
    assert "rad1" in questions[0].studentWork


# ---------------------------------------------------------------------------
# Permanenta fel: needs_review med felorsak, aldrig påhittat resultat
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_persistent_failure_yields_needs_review(monkeypatch):
    _install(monkeypatch, [(500, "boom")])
    questions, meta = await gemini_vision.analyze_document(
        pages=_pages(), answer_key=[_item()]
    )
    assert len(questions) == 1
    q = questions[0]
    assert q.assessment.status == "needs_review"
    assert q.assessment.points == 0.0
    assert q.studentWork == ""          # inget påhittat elevarbete
    assert q.error is not None
    assert meta.error is not None


@pytest.mark.asyncio
async def test_auth_error_is_not_retried(monkeypatch):
    _install(monkeypatch, [(403, "forbidden")])
    questions, meta = await gemini_vision.analyze_document(
        pages=_pages(), answer_key=[_item()]
    )
    assert _MockClient.calls == 1       # ingen meningslös retry
    assert questions[0].assessment.status == "needs_review"
    assert meta.error is not None


@pytest.mark.asyncio
async def test_no_pages_does_not_crash(monkeypatch):
    _install(monkeypatch, [(200, _gemini_body(_valid_payload()))])
    questions, meta = await gemini_vision.analyze_document(pages=[], answer_key=[_item()])
    assert questions[0].assessment.status == "needs_review"
    assert meta.error is not None
    assert _MockClient.calls == 0       # inget anrop utan sidor


@pytest.mark.asyncio
async def test_empty_answer_key_with_no_detected_questions_returns_nothing(monkeypatch):
    """Facitfritt läge (answer_key=[]): hittar AI:n ingen tryckt frågetext i
    dokumentet ska den returnera en tom 'questions'-lista (se prompten i
    gemini_vision._build_prompt, punkt 2) – och pipen ska förmedla det som
    en tom, felfri resultatlista (ingen crash, inget påhittat innehåll)."""
    empty_payload = {"questions": [], "unlisted_questions": []}
    _install(monkeypatch, [(200, _gemini_body(empty_payload))])
    questions, meta = await gemini_vision.analyze_document(pages=_pages(), answer_key=[])
    assert questions == []
    assert meta.error is None


@pytest.mark.asyncio
async def test_empty_answer_key_grades_ai_detected_questions(monkeypatch):
    """Facitfritt läge (answer_key=[]): hittar AI:n en uppgift med tryckt
    frågetext ska den bedömas och returneras – det är HELA syftet med
    facitfritt läge (AI:n genererar facit och bedömning i samma anrop, se
    gemini_vision._analyze_chunk). Detta är INTE en felväg."""
    _install(monkeypatch, [(200, _gemini_body(_valid_payload()))])
    questions, meta = await gemini_vision.analyze_document(pages=_pages(), answer_key=[])
    assert len(questions) == 1
    assert questions[0].questionNumber == "1"
    assert questions[0].assessment.status == "correct"
    assert meta.error is None


# ---------------------------------------------------------------------------
# Invarianter: modellen får inte prata omkull koden
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_model_omitting_question_gives_not_found(monkeypatch):
    _install(monkeypatch, [(200, _gemini_body({"questions": [], "unlisted_questions": []}))])
    questions, _ = await gemini_vision.analyze_document(
        pages=_pages(), answer_key=[_item()]
    )
    assert questions[0].found is False
    assert questions[0].studentWork == ""
    assert questions[0].assessment.status == "needs_review"


@pytest.mark.asyncio
async def test_not_found_cannot_carry_student_work(monkeypatch):
    """found=False + påhittat arbete ska tvingas till tomt."""
    payload = _valid_payload()
    payload["questions"][0]["found"] = False
    payload["questions"][0]["student_work"] = "2 + 2 = 4"
    payload["questions"][0]["points"] = 2.0
    _install(monkeypatch, [(200, _gemini_body(payload))])
    questions, _ = await gemini_vision.analyze_document(
        pages=_pages(), answer_key=[_item()]
    )
    assert questions[0].studentWork == ""
    assert questions[0].assessment.points == 0.0
    assert questions[0].assessment.status == "needs_review"


@pytest.mark.asyncio
async def test_points_are_clamped_to_max(monkeypatch):
    payload = _valid_payload()
    payload["questions"][0]["points"] = 99.0
    _install(monkeypatch, [(200, _gemini_body(payload))])
    questions, _ = await gemini_vision.analyze_document(
        pages=_pages(), answer_key=[_item(max_points=2.0)]
    )
    assert questions[0].assessment.points == 2.0


@pytest.mark.asyncio
async def test_low_transcription_confidence_forces_review(monkeypatch):
    """Oläslig handstil: behåll transkriptionen men lämna till människa."""
    payload = _valid_payload()
    payload["questions"][0]["transcription_confidence"] = 0.2
    payload["questions"][0]["status"] = "correct"
    payload["questions"][0]["points"] = 2.0
    _install(monkeypatch, [(200, _gemini_body(payload))])
    questions, _ = await gemini_vision.analyze_document(
        pages=_pages(), answer_key=[_item()]
    )
    q = questions[0]
    assert q.found is True                 # uppgiften FINNS
    assert q.studentWork == "2 + 2 = 4"    # transkriptionen behålls åt läraren
    assert q.assessment.status == "needs_review"
    assert q.assessment.points == 0.0


@pytest.mark.asyncio
async def test_correct_requires_full_points(monkeypatch):
    payload = _valid_payload()
    payload["questions"][0]["status"] = "correct"
    payload["questions"][0]["points"] = 1.0     # inte full poäng
    _install(monkeypatch, [(200, _gemini_body(payload))])
    questions, _ = await gemini_vision.analyze_document(
        pages=_pages(), answer_key=[_item(max_points=2.0)]
    )
    assert questions[0].assessment.status == "partial"


@pytest.mark.asyncio
async def test_unlisted_question_is_surfaced(monkeypatch):
    payload = _valid_payload()
    payload["unlisted_questions"] = [
        {
            "question_number": "7",
            "question_text": "Extra uppgift",
            "student_work": "svar",
            "transcription_confidence": 0.9,
            "source_regions": [],
        }
    ]
    _install(monkeypatch, [(200, _gemini_body(payload))])
    questions, _ = await gemini_vision.analyze_document(
        pages=_pages(), answer_key=[_item()]
    )
    extra = [q for q in questions if not q.inAnswerKey]
    assert len(extra) == 1
    assert extra[0].questionNumber == "7"
    assert extra[0].assessment.status == "needs_review"


@pytest.mark.asyncio
async def test_bad_status_value_falls_back_to_review(monkeypatch):
    payload = _valid_payload()
    payload["questions"][0]["status"] = "AMAZING"
    _install(monkeypatch, [(200, _gemini_body(payload))])
    questions, _ = await gemini_vision.analyze_document(
        pages=_pages(), answer_key=[_item()]
    )
    assert questions[0].assessment.status == "needs_review"


@pytest.mark.asyncio
async def test_multipage_regions_are_clamped_to_page_count(monkeypatch):
    payload = _valid_payload()
    payload["questions"][0]["source_regions"] = [
        {"page": 99, "x": 0.1, "y": 0.1, "width": 0.5, "height": 0.2},
        {"page": 2, "x": 2000, "y": 3000, "width": 500, "height": 400},
    ]
    _install(monkeypatch, [(200, _gemini_body(payload))])
    questions, _ = await gemini_vision.analyze_document(
        pages=_pages(2), answer_key=[_item()]
    )
    regions = questions[0].sourceRegions
    assert all(1 <= r.page <= 2 for r in regions)
    assert all(0.0 <= r.x <= 1.0 and 0.0 <= r.width <= 1.0 for r in regions)


# ---------------------------------------------------------------------------
# Sidgruppering (multipage)
# ---------------------------------------------------------------------------


def _upload(name: str) -> UploadedFile:
    return UploadedFile(filename=name, content=PNG_1PX, content_type="image/png")


def test_pages_group_into_one_document():
    docs = group_pages_by_student(
        [_upload("Anna_Andersson_sida1.png"), _upload("Anna_Andersson_sida2.png")]
    )
    assert len(docs) == 1
    assert len(docs[0].pages) == 2
    assert docs[0].student_name == "Anna Andersson"


def test_pages_are_ordered_even_if_uploaded_out_of_order():
    docs = group_pages_by_student(
        [
            _upload("Berg_Elev_sida3.png"),
            _upload("Berg_Elev_sida1.png"),
            _upload("Berg_Elev_sida2.png"),
        ]
    )
    assert len(docs) == 1
    assert [p.filename for p in docs[0].pages] == [
        "Berg_Elev_sida1.png",
        "Berg_Elev_sida2.png",
        "Berg_Elev_sida3.png",
    ]


def test_different_students_stay_separate():
    docs = group_pages_by_student(
        [_upload("Anna_Andersson.png"), _upload("Erik_Eriksson.png")]
    )
    assert len(docs) == 2
    assert {d.student_name for d in docs} == {"Anna Andersson", "Erik Eriksson"}


def test_parenthesis_page_suffix_groups():
    docs = group_pages_by_student(
        [_upload("Sara Lind (1).png"), _upload("Sara Lind (2).png")]
    )
    assert len(docs) == 1
    assert len(docs[0].pages) == 2


def test_student_name_without_page_suffix_is_single_page():
    docs = group_pages_by_student([_upload("Linnea_Svensson.png")])
    assert len(docs) == 1
    assert len(docs[0].pages) == 1
    assert docs[0].student_name == "Linnea Svensson"


def test_derive_student_name_strips_suffix():
    assert derive_student_name("Anna_Andersson - prov") == "Anna Andersson"


def test_pdf_upload_is_split_into_traceable_single_page_documents():
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.add_blank_page(width=100, height=100)
    buffer = BytesIO()
    writer.write(buffer)

    expanded = expand_pdf_uploads(
        [UploadedFile("klassprov.pdf", buffer.getvalue(), "application/pdf")]
    )
    assert len(expanded) == 2
    assert [page.page_number for page in expanded] == [1, 2]
    assert all(page.source_id == "klassprov.pdf" for page in expanded)
    assert all(page.content_type == "image/png" for page in expanded)
    assert all(page.content.startswith(b"\x89PNG") for page in expanded)


@pytest.mark.asyncio
async def test_low_confidence_names_never_merge_generic_pages(monkeypatch):
    async def identify(page, *, identification_method):
        return IdentifiedName("Anna Andersson", 0.2, "name_field")

    monkeypatch.setattr(batch_pipeline, "extract_student_name", identify)
    files = [
        UploadedFile("IMG_001.png", b"first", "image/png"),
        UploadedFile("IMG_002.png", b"second", "image/png"),
    ]
    documents = await identify_and_group_pages(files)
    assert len(documents) == 2
    assert all(document.identification_method == "unresolved" for document in documents)
    assert all(document.identification_confidence == 0 for document in documents)


@pytest.mark.asyncio
async def test_filename_group_uses_one_confident_name_field(monkeypatch):
    async def identify(page, *, identification_method):
        return (
            IdentifiedName("Anna Andersson", 0.96, "name_field")
            if page[0] == b"first"
            else IdentifiedName(None, 0.0, "name_field_empty")
        )

    monkeypatch.setattr(batch_pipeline, "extract_student_name", identify)
    files = [
        UploadedFile("Anna_Andersson_sida2.png", b"second", "image/png"),
        UploadedFile("Anna_Andersson_sida1.png", b"first", "image/png"),
    ]
    documents = await identify_and_group_pages(files)
    assert len(documents) == 1
    assert documents[0].student_name == "Anna Andersson"
    assert documents[0].identification_method == "name_field"
    assert documents[0].identification_confidence == 0.96
    assert [page.content for page in documents[0].pages] == [b"first", b"second"]


def test_feedback_output_never_exposes_internal_reasoning():
    raw = "<think>hemligt resonemang</think><thinking>mer internt</thinking>Bra försök.```"
    assert feedback._safe_output(raw) == "Bra försök."


@pytest.mark.asyncio
async def test_math_verification_only_runs_for_relevant_questions(monkeypatch):
    calls: list[tuple[str, str]] = []

    class Verifier:
        async def verify_equation(self, student_answer, correct_answer):
            calls.append((student_answer, correct_answer))
            return WolframResult(is_correct=True, confidence=0.99)

    monkeypatch.setattr(batch_pipeline, "get_math_provider", lambda: Verifier())
    monkeypatch.setattr(batch_pipeline.settings, "WOLFRAM_APP_ID", "configured")
    math_question = QuestionResult(
        questionNumber="1",
        found=True,
        studentWork="x = 2",
        assessment=Assessment(status="partial", points=0.5, maxPoints=1),
    )
    language_question = QuestionResult(
        questionNumber="2",
        found=True,
        studentWork="Stockholm",
        assessment=Assessment(status="correct", points=1, maxPoints=1),
    )
    answer_key = [
        AnswerKeyItem(question_number="1", question_text="Lös x + 1 = 3", final_answer="x = 2"),
        AnswerKeyItem(question_number="2", question_text="Sveriges huvudstad?", final_answer="Stockholm"),
    ]

    await apply_math_verification([math_question, language_question], answer_key)
    assert calls == [("x = 2", "x = 2")]
    assert math_question.mathVerification.status == "verified"
    assert math_question.assessment.status == "correct"
    assert math_question.assessment.points == 1
    assert language_question.mathVerification.status == "not_applicable"


def test_persist_batch_keeps_scans_identity_answer_key_and_is_idempotent():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    klass = models.Klass(teacher_id="teacher-1", name="NA1", kurs_id="matte4")
    klass.students.append(models.KlassStudent(name="Anna Andersson"))
    test = models.Test(title="Algebra", facit_mode="uploaded", max_points=0)
    klass.tests.append(test)
    db.add(klass)
    db.commit()

    result = StudentDocumentResult(
        id="batch-result-1",
        provId=test.id,
        studentName="Anna Andersson",
        identificationMethod="name_field",
        identificationConfidence=0.96,
        scanPages=["data:image/png;base64,AA=="],
        document=DocumentMeta(pageCount=1, model="test-model"),
        questions=[
            QuestionResult(
                questionNumber="1",
                found=True,
                questionText="Vad är 2 + 2?",
                studentWork="4",
                transcriptionConfidence=0.95,
                correctAnswer="4",
                assessment=Assessment(status="correct", points=2, maxPoints=2, confidence=0.98),
                feedback="Rätt.",
                annotation=Annotation(summary="Korrekt."),
            )
        ],
    )
    _persist_batch(db, test, [result], [_item(max_points=2)])
    _persist_batch(db, test, [result], [_item(max_points=2)])

    stored = db.query(models.GradingResult).one()
    assert stored.id == result.id
    assert stored.student_id == klass.students[0].id
    assert stored.identification_confidence == 0.96
    assert stored.scan_pages == ["data:image/png;base64,AA=="]
    assert stored.document["model"] == "test-model"
    assert stored.steps[0]["studentWork"] == "4"
    assert stored.total_score == 2
    assert stored.max_score == 2
    assert db.query(models.AnswerKeyRecord).one().items[0]["final_answer"] == "4"
    assert test.status == "review"
