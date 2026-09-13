"""Answer-key parsing tests.

Tests _parse_items and _extract_json_array edge cases — no network required.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.schemas import AnswerKeyItem
from app.services.answer_key import (
    _extract_json_array,
    QuestionSheetInferenceError,
    _balanced_json,
    _normalize_question_number,
    _parse_items,
    _question_manifest,
    infer_question_sheet,
)


# ---------------------------------------------------------------------------
# _extract_json_array
# ---------------------------------------------------------------------------


def test_extract_json_array_plain():
    text = '[{"question_number": "1", "question_text": "Q", "final_answer": "A"}]'
    result = _extract_json_array(text)
    assert len(result) == 1


def test_extract_json_array_wrapped_in_items():
    text = '{"items": [{"question_number": "1", "question_text": "Q", "final_answer": "A"}]}'
    result = _extract_json_array(text)
    assert len(result) == 1


def test_extract_json_array_wrapped_in_answer_key():
    text = '{"answer_key": [{"question_number": "1", "question_text": "Q", "final_answer": "A"}]}'
    result = _extract_json_array(text)
    assert len(result) == 1


def test_extract_json_array_wrapped_in_questions():
    text = '{"questions": [{"question_number": "1", "question_text": "Q", "final_answer": "A"}]}'
    result = _extract_json_array(text)
    assert len(result) == 1


def test_extract_json_array_wrapped_in_facit():
    text = '{"facit": [{"question_number": "1", "question_text": "Q", "final_answer": "A"}]}'
    result = _extract_json_array(text)
    assert len(result) == 1


def test_extract_json_array_with_markdown_fences():
    text = '```json\n[{"question_number": "1", "question_text": "Q", "final_answer": "A"}]\n```'
    result = _extract_json_array(text)
    assert len(result) == 1


def test_extract_json_array_with_surrounding_text():
    text = 'Här är facit:\n[{"question_number": "1", "question_text": "Q", "final_answer": "A"}]\nKlart!'
    result = _extract_json_array(text)
    assert len(result) == 1


def test_extract_json_array_empty_list():
    text = '[]'
    result = _extract_json_array(text)
    assert result == []


def test_extract_json_array_no_json():
    with pytest.raises(ValueError, match="ingen JSON-array"):
        _extract_json_array("Detta är inte JSON alls.")


def test_extract_json_array_invalid_json():
    with pytest.raises(ValueError):
        _extract_json_array("{invalid json}")


def test_extract_json_array_object_without_list():
    with pytest.raises(ValueError, match="ingen lista"):
        _extract_json_array('{"foo": "bar"}')


# ---------------------------------------------------------------------------
# _normalize_question_number
# ---------------------------------------------------------------------------


def test_normalize_question_number_plain():
    assert _normalize_question_number("1") == "1"


def test_normalize_question_number_uppgift():
    assert _normalize_question_number("Uppgift 1") == "1"


def test_normalize_question_number_with_dot():
    assert _normalize_question_number("1.") == "1"


def test_normalize_question_number_with_paren():
    assert _normalize_question_number("1)") == "1"


def test_normalize_question_number_q_prefix():
    assert _normalize_question_number("Q1") == "1"


def test_normalize_question_number_letter():
    assert _normalize_question_number("2a") == "2a"


def test_normalize_question_number_uppgift_letter():
    assert _normalize_question_number("Uppgift 2a") == "2a"


# ---------------------------------------------------------------------------
# _parse_items
# ---------------------------------------------------------------------------


def test_parse_items_valid():
    text = json.dumps([{
        "question_number": "1",
        "question_text": "Vad är 2+2?",
        "final_answer": "4",
        "max_points": 2,
    }])
    items = _parse_items(text)
    assert len(items) == 1
    assert items[0].question_number == "1"
    assert items[0].final_answer == "4"
    assert items[0].max_points == 2


def test_parse_items_normalizes_numbers():
    text = json.dumps([
        {"question_number": "Uppgift 1", "question_text": "Q1", "final_answer": "A1"},
        {"question_number": "2)", "question_text": "Q2", "final_answer": "A2"},
    ])
    items = _parse_items(text)
    assert items[0].question_number == "1"
    assert items[1].question_number == "2"


def test_parse_items_defaults():
    """Missing optional fields get defaults."""
    text = json.dumps([{"question_number": "1", "question_text": "Q", "final_answer": "A"}])
    items = _parse_items(text)
    assert items[0].max_points == 1.0
    assert items[0].acceptable_answers == []
    assert items[0].derivation_steps == []


def _manifest(*numbers: str) -> str:
    return json.dumps({
        "primaryDocumentFound": True,
        "primaryDocumentConfidence": 0.95,
        "primaryDocumentRegion": {"x": 0.1, "y": 0.1, "width": 0.7, "height": 0.8},
        "multipleDocumentsAmbiguous": False,
        "ambiguityReason": "",
        "questions": [
            {
                "question_number": number,
                "question_text": f"Detta är den fullständiga frågan nummer {number}",
                "max_points": 1,
                "confidence": 0.95,
                "question_region": {"x": 0.2, "y": 0.2, "width": 0.4, "height": 0.1},
            }
            for number in numbers
        ],
    })


async def test_infer_question_sheet_merges_pages_and_ignores_duplicate_numbers():
    solved = [
        AnswerKeyItem(question_number=n, question_text=f"Fråga {n}", final_answer=f"Svar {n}")
        for n in ("1", "2", "3")
    ]
    with patch(
        "app.services.answer_key.vision_ocr.read_image_structured",
        new_callable=AsyncMock,
        side_effect=[_manifest("1", "2"), _manifest("2", "3")],
    ) as read, patch(
        "app.services.answer_key._solve_manifest",
        new_callable=AsyncMock,
        return_value=solved,
    ) as solve:
        items = await infer_question_sheet([(b"one", "image/jpeg"), (b"two", "image/jpeg")])

    assert [item.question_number for item in items] == ["1", "2", "3"]
    assert [item["question_number"] for item in solve.await_args.args[0]] == ["1", "2", "3"]
    assert "Bilden FÅR vara en skärmdump" in read.await_args_list[0].args[2]


async def test_production_missing_comma_json_retries_then_succeeds():
    malformed = _manifest("1").replace('"max_points": 1,', '"max_points": 1')
    with patch(
        "app.services.answer_key.vision_ocr.read_image_structured",
        new_callable=AsyncMock,
        side_effect=[malformed, malformed, _manifest("1")],
    ) as read, patch(
        "app.services.answer_key._solve_manifest",
        new_callable=AsyncMock,
        return_value=[AnswerKeyItem(question_number="1", question_text="Fråga", final_answer="Svar")],
    ):
        items = await infer_question_sheet([(b"image", "image/jpeg")])

    assert read.await_count == 3
    assert items[0].question_number == "1"


def test_production_extra_data_uses_first_complete_object():
    raw = _manifest("1") + "\n" + json.dumps({"irrelevant": True})
    parsed = _balanced_json(raw)
    assert isinstance(parsed, dict)
    assert parsed["questions"][0]["question_number"] == "1"


def test_question_outside_primary_paper_is_discarded():
    data = json.loads(_manifest("1", "2"))
    data["questions"][1]["question_region"] = {
        "x": 0.88, "y": 0.2, "width": 0.1, "height": 0.1,
    }
    manifest = _question_manifest(json.dumps(data))
    assert [item["question_number"] for item in manifest] == ["1"]


def test_browser_ui_around_clear_paper_is_accepted():
    manifest = _question_manifest(_manifest("1", "2", "3", "4", "5"))
    assert len(manifest) == 5


def test_two_equal_documents_fail_with_specific_kind():
    data = json.loads(_manifest("1"))
    data["multipleDocumentsAmbiguous"] = True
    data["ambiguityReason"] = "Två lika stora dokument"
    with pytest.raises(QuestionSheetInferenceError) as exc:
        _question_manifest(json.dumps(data))
    assert exc.value.kind == "multiple_documents"


async def test_infer_question_sheet_reports_provider_error_when_unreadable():
    with patch(
        "app.services.answer_key.vision_ocr.read_image_structured",
        new_callable=AsyncMock,
        side_effect=RuntimeError("provider unavailable"),
    ):
        with pytest.raises(QuestionSheetInferenceError) as exc:
            await infer_question_sheet([(b"bad", "image/jpeg")])
    assert exc.value.kind == "provider_error"
