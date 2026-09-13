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
    _split_page_suffix,
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
    # JPEG-rasterisering: skannade sidor är foton — 5–10× mindre än PNG.
    assert all(page.content_type == "image/jpeg" for page in expanded)
    assert all(page.content.startswith(b"\xff\xd8\xff") for page in expanded)


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


# ---------------------------------------------------------------------------
# Golden: elevgruppering — reproduktion av produktionsbuggen "prov1–prov5"
# ---------------------------------------------------------------------------


def test_page_suffix_requires_separator_or_keyword():
    """Naken siffra på stammen är inte ett sidsuffix ("prov1" ≠ sida 1)."""
    assert _split_page_suffix("prov1") == ("prov1", 1)
    assert _split_page_suffix("scan3") == ("scan3", 1)
    assert _split_page_suffix("bild5") == ("bild5", 1)
    # Separator eller nyckelord → fortfarande sidsuffix som förut.
    assert _split_page_suffix("Anna_sida2") == ("Anna", 2)
    assert _split_page_suffix("Sara Lind (2)") == ("Sara Lind", 2)
    assert _split_page_suffix("Anna - p3") == ("Anna", 3)


def test_bare_digit_filenames_stay_separate_documents():
    """prov1..prov5 är fem separata elever — aldrig sidor i samma dokument."""
    docs = group_pages_by_student([_upload(f"prov{i}.png") for i in range(1, 6)])
    assert len(docs) == 5
    assert all(len(d.pages) == 1 for d in docs)


def test_generic_swedish_stems_never_become_name_buckets():
    """"prov 2", "tenta_1" etc. är generiska stammar — eget dokument per fil."""
    docs = group_pages_by_student(
        [_upload("prov 1.png"), _upload("prov 2.png"), _upload("tenta_1.png")]
    )
    assert len(docs) == 3


@pytest.mark.asyncio
async def test_conflicting_names_in_bucket_are_split_not_merged(monkeypatch):
    """Bucket med flera säkra men OLIKA namn splittas — ett dokument per elev.

    Reproducerar produktionsbuggen: tidigare markerades detta som
    'conflicting_name_fields' och alla sidor slogs ihop till "Okänd elev".
    """
    names = {
        b"p1": "Sara Lindqvist",
        b"p2": "Elin Karlsson",
        b"p3": "Marcus Bergström",
        b"p4": "Oskar Nyström",
        b"p5": "Vera Holm",
    }

    async def identify(page, *, identification_method):
        return IdentifiedName(names[page[0]], 0.95, "name_field")

    monkeypatch.setattr(batch_pipeline, "extract_student_name", identify)
    # Fem filer som filnamnsbucketas ihop (samma icke-generiska stam +
    # explicit sidsuffix) men som innehåller fem olika elever.
    files = [
        UploadedFile(f"Fysikprov_sida{i}.png", f"p{i}".encode(), "image/png")
        for i in range(1, 6)
    ]
    documents = await identify_and_group_pages(files)
    assert len(documents) == 5
    assert {d.student_name for d in documents} == set(names.values())
    assert all(d.identification_method == "name_field" for d in documents)
    assert all(len(d.pages) == 1 for d in documents)


@pytest.mark.asyncio
async def test_class_pdf_splits_into_per_student_documents(monkeypatch):
    """Sammanslagen klass-PDF: nytt säkert namnfält öppnar nytt elevsegment."""
    writer = PdfWriter()
    for _ in range(6):
        writer.add_blank_page(width=100, height=100)
    buf = BytesIO()
    writer.write(buf)
    files = expand_pdf_uploads(
        [UploadedFile("klassprov.pdf", buf.getvalue(), "application/pdf")]
    )
    assert len(files) == 6

    per_page = iter(
        [
            "Sara Lindqvist",   # sida 1 — ankare
            "Sara Lindqvist",   # sida 2 — samma elev, fortsättning
            "Elin Karlsson",    # sida 3 — nytt ankare
            "Marcus Bergström", # sida 4 — nytt ankare
            "Marcus Bergström",
            "Marcus Bergström",
        ]
    )

    async def identify(page, *, identification_method):
        return IdentifiedName(next(per_page), 0.95, "name_field")

    monkeypatch.setattr(batch_pipeline, "extract_student_name", identify)
    documents = await identify_and_group_pages(files)
    assert [d.student_name for d in documents] == [
        "Sara Lindqvist",
        "Elin Karlsson",
        "Marcus Bergström",
    ]
    assert [len(d.pages) for d in documents] == [2, 1, 3]


@pytest.mark.asyncio
async def test_multi_page_same_student_stays_one_document(monkeypatch):
    """Regressionsskydd: 2 sidor samma elev (samma namnfält) = 1 inlämning."""
    async def identify(page, *, identification_method):
        return IdentifiedName("Anna Andersson", 0.95, "name_field")

    monkeypatch.setattr(batch_pipeline, "extract_student_name", identify)
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.add_blank_page(width=100, height=100)
    buf = BytesIO()
    writer.write(buf)
    files = expand_pdf_uploads(
        [UploadedFile("anna.pdf", buf.getvalue(), "application/pdf")]
    )
    documents = await identify_and_group_pages(files)
    assert len(documents) == 1
    assert documents[0].student_name == "Anna Andersson"
    assert len(documents[0].pages) == 2


# ---------------------------------------------------------------------------
# Golden: dokumenttypklassificering — blankett/facit flaggas, rättas aldrig
# som elevinlämning med 0 poäng. Reproducerar test_PROV_2-fallet.
# ---------------------------------------------------------------------------


class _CountingVisionProvider:
    """Minimal vision-provider som bara räknar anrop."""

    def __init__(self):
        self.calls = 0

    async def analyze_document(
        self, *, pages, answer_key, grading_notes, student_label
    ):
        self.calls += 1
        meta = DocumentMeta(
            pageCount=len(pages), model="test", questionsExpected=len(answer_key)
        )
        questions = [
            QuestionResult(
                questionNumber=str(i.question_number),
                found=True,
                studentWork="elevens svar",
                correctAnswer=i.final_answer,
                assessment=Assessment(
                    status="correct", points=i.max_points, maxPoints=i.max_points
                ),
            )
            for i in answer_key
        ]
        return questions, meta


async def _noop_math_verification(questions, answer_key):
    return None


async def _noop_feedback_provider(questions):
    return None


def _mock_grading(monkeypatch, provider: _CountingVisionProvider):
    monkeypatch.setattr(batch_pipeline, "get_vision_provider", lambda: provider)
    monkeypatch.setattr(
        batch_pipeline, "apply_math_verification", _noop_math_verification
    )
    monkeypatch.setattr(
        batch_pipeline, "apply_feedback_provider", _noop_feedback_provider
    )


@pytest.mark.asyncio
async def test_blank_exam_and_key_flagged_not_graded(monkeypatch):
    """PDF med frågeblad + facit, inget elevarbete: flaggas som
    'not_student_submission' och rättningsmotorn anropas ALDRIG."""
    writer = PdfWriter()
    for _ in range(4):
        writer.add_blank_page(width=100, height=100)
    buf = BytesIO()
    writer.write(buf)
    files = expand_pdf_uploads(
        [UploadedFile("test_PROV_2.pdf", buf.getvalue(), "application/pdf")]
    )
    assert len(files) == 4

    specs = iter(
        [
            ("question_sheet", False),
            ("question_sheet", False),
            # Handskriven facit — får aldrig vändas till elevarbete.
            ("answer_key", True),
            ("answer_key", True),
        ]
    )

    async def identify(page, *, identification_method):
        page_type, handwriting = next(specs)
        return IdentifiedName(
            None, 0.0, "name_field",
            pageType=page_type, hasHandwriting=handwriting,
            documentTitle="Prov 1 (Analysdelen)",
        )

    monkeypatch.setattr(batch_pipeline, "extract_student_name", identify)
    provider = _CountingVisionProvider()
    _mock_grading(monkeypatch, provider)

    results = await batch_pipeline.grade_batch(
        prov_id="p1",
        answer_key=[_item()],
        class_grading_parameters="",
        test_specific_parameters="",
        files=files,
    )
    assert provider.calls == 0
    assert results
    assert all(
        r.document.documentType == "not_student_submission" for r in results
    )
    assert all(
        q.assessment.status == "needs_review"
        for r in results
        for q in r.questions
    )
    assert all(
        "elevinlämning" in q.feedback for r in results for q in r.questions
    )


@pytest.mark.asyncio
async def test_answer_key_never_absorbs_into_student_segment(monkeypatch):
    """Facitsida mellan elevsidor i samma PDF: aldrig fortsättningssida —
    den blir eget flaggat segment och elevens sidor rättas utan den."""
    writer = PdfWriter()
    for _ in range(3):
        writer.add_blank_page(width=100, height=100)
    buf = BytesIO()
    writer.write(buf)
    files = expand_pdf_uploads(
        [UploadedFile("anna_med_facit.pdf", buf.getvalue(), "application/pdf")]
    )

    per_page = iter(
        [
            IdentifiedName("Anna Andersson", 0.95, "name_field",
                           pageType="student_work", hasHandwriting=True,
                           documentTitle="Prov 1"),
            IdentifiedName(None, 0.0, "name_field",
                           # Handskriven facit — hasHandwriting får ALDRIG
                           # vända answer_key till elevarbete.
                           pageType="answer_key", hasHandwriting=True,
                           documentTitle="Lösningsförslag"),
            IdentifiedName("Anna Andersson", 0.95, "name_field",
                           pageType="student_work", hasHandwriting=True,
                           documentTitle="Prov 1"),
        ]
    )

    async def identify(page, *, identification_method):
        return next(per_page)

    monkeypatch.setattr(batch_pipeline, "extract_student_name", identify)
    provider = _CountingVisionProvider()
    _mock_grading(monkeypatch, provider)

    results = await batch_pipeline.grade_batch(
        prov_id="p1",
        answer_key=[_item()],
        class_grading_parameters="",
        test_specific_parameters="",
        files=files,
    )
    student_results = [
        r for r in results if r.document.documentType == "student_submission"
    ]
    flagged = [
        r for r in results if r.document.documentType == "not_student_submission"
    ]
    # Facitsidan är aldrig del av ett elevsegment.
    assert all(len(r.scanPages) == 1 for r in student_results)
    assert len(flagged) == 1
    # Endast elevsegmenten skickas till rättningsmotorn.
    assert provider.calls == len(student_results)


@pytest.mark.asyncio
async def test_header_boundary_splits_same_source(monkeypatch):
    """Ny utskriven rubrik mitt i samma källa bryter segmentet — även när
    sidan saknar namnankare (positionell fortsättning räcker inte över en
    dokumentgräns)."""
    writer = PdfWriter()
    for _ in range(3):
        writer.add_blank_page(width=100, height=100)
    buf = BytesIO()
    writer.write(buf)
    files = expand_pdf_uploads(
        [UploadedFile("tvaprov.pdf", buf.getvalue(), "application/pdf")]
    )

    per_page = iter(
        [
            IdentifiedName("Anna Andersson", 0.95, "name_field",
                           pageType="student_work", hasHandwriting=True,
                           documentTitle="Prov 1"),
            IdentifiedName(None, 0.0, "name_field",
                           pageType="question_sheet", documentTitle="Prov 2"),
            IdentifiedName(None, 0.0, "name_field",
                           pageType="student_work", hasHandwriting=True,
                           documentTitle="Prov 2"),
        ]
    )

    async def identify(page, *, identification_method):
        return next(per_page)

    monkeypatch.setattr(batch_pipeline, "extract_student_name", identify)
    documents = await identify_and_group_pages(files)
    # "Prov 2"-sidorna bryts ut till ett eget segment — de hakar aldrig på
    # Annas segment trots att de ligger i samma namn-bucket/källa, och de
    # ärver inte Annas identitet (saknar eget namnankare).
    assert len(documents) == 2
    assert documents[0].student_name == "Anna Andersson"
    assert len(documents[0].pages) == 1
    assert documents[0].document_type == "student_submission"
    assert documents[1].student_name != "Anna Andersson"
    assert len(documents[1].pages) == 2
    assert documents[1].document_type == "student_submission"


@pytest.mark.asyncio
async def test_failed_classification_stays_gradeable(monkeypatch):
    """Provideravbrott i extraktionen = ingen signal — dokumentet rättas
    som förr men flaggas 'unverified' så läraren ser att det är obekräftat."""
    async def identify(page, *, identification_method):
        return IdentifiedName(None, 0.0, "name_field_failed")

    monkeypatch.setattr(batch_pipeline, "extract_student_name", identify)
    provider = _CountingVisionProvider()
    _mock_grading(monkeypatch, provider)

    results = await batch_pipeline.grade_batch(
        prov_id="p1",
        answer_key=[_item()],
        class_grading_parameters="",
        test_specific_parameters="",
        files=[UploadedFile("elev1.png", b"img", "image/png")],
    )
    assert provider.calls == 1
    assert results[0].document.documentType == "unverified"


@pytest.mark.asyncio
async def test_handwritten_answers_on_question_sheet_still_grade(monkeypatch):
    """Regressionsskydd: ifyllt frågeblad (tryckt sida + handstil) är
    elevarbete och rättas normalt — aldrig flaggat som blankett."""
    async def identify(page, *, identification_method):
        return IdentifiedName(
            "Anna Andersson", 0.95, "name_field",
            pageType="question_sheet", hasHandwriting=True,
            documentTitle="Prov 1",
        )

    monkeypatch.setattr(batch_pipeline, "extract_student_name", identify)
    provider = _CountingVisionProvider()
    _mock_grading(monkeypatch, provider)

    results = await batch_pipeline.grade_batch(
        prov_id="p1",
        answer_key=[_item()],
        class_grading_parameters="",
        test_specific_parameters="",
        files=[UploadedFile("ifylld_blankett.png", b"img", "image/png")],
    )
    assert provider.calls == 1
    assert results[0].document.documentType == "student_submission"
    assert results[0].questions[0].assessment.status == "correct"


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
    answer_key = db.query(models.AnswerKeyRecord).one()
    assert answer_key.items[0]["final_answer"] == "4"
    assert answer_key.source == "uploaded"
    assert test.status == "review"
