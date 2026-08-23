"""Felfalls- och invariant-tester för rättningsmotorn.

Kör utan nätverk: Gemini-anropet mockas. Syftet är att bevisa att systemet
aldrig kraschar och aldrig fejkar ett resultat när något går fel.

    python -m pytest tests/test_failure_modes.py -v
"""
from __future__ import annotations

import json

import httpx
import pytest

from app.schemas import AnswerKeyItem
from app.services import gemini_vision
from app.services.batch_pipeline import (
    UploadedFile,
    derive_student_name,
    group_pages_by_student,
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
async def test_empty_answer_key_returns_nothing(monkeypatch):
    _install(monkeypatch, [(200, _gemini_body(_valid_payload()))])
    questions, meta = await gemini_vision.analyze_document(pages=_pages(), answer_key=[])
    assert questions == []
    assert meta.error is not None


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
