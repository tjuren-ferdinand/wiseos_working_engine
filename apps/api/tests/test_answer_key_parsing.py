"""Answer-key parsing tests.

Tests _parse_items and _extract_json_array edge cases — no network required.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.schemas import AnswerKeyItem
from app.services.answer_key import (
    _extract_json_array,
    _normalize_question_number,
    _parse_items,
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
