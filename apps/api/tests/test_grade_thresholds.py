from __future__ import annotations

import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.schemas import ClassCreate, ClassUpdate, CourseCreate, CourseUpdate, GradeThresholdsSchema


DEFAULTS = {"A": 90, "B": 80, "C": 65, "D": 50, "E": 35, "F": 0}


@pytest.mark.parametrize("grade", list(DEFAULTS))
@pytest.mark.parametrize("value", [-1, 101, float("nan"), float("inf"), float("-inf")])
def test_thresholds_reject_nonfinite_or_out_of_range_values(grade, value):
    with pytest.raises(ValidationError):
        GradeThresholdsSchema.model_validate({grade: value})


@pytest.mark.parametrize("upper,lower", list(zip("ABCDE", "BCDEF")))
def test_thresholds_reject_inverted_order(upper, lower):
    values = dict(DEFAULTS)
    values[upper] = values[lower] - 1
    with pytest.raises(ValidationError):
        GradeThresholdsSchema.model_validate(values)


def test_defaults_partial_values_ties_and_numeric_coercion_preserved():
    assert GradeThresholdsSchema().model_dump() == DEFAULTS
    assert GradeThresholdsSchema(A="95").model_dump() == {**DEFAULTS, "A": 95}
    assert GradeThresholdsSchema(**dict.fromkeys(DEFAULTS, 0)).model_dump() == dict.fromkeys(DEFAULTS, 0)
    assert GradeThresholdsSchema(**dict.fromkeys(DEFAULTS, 100)).model_dump() == dict.fromkeys(DEFAULTS, 100)
    assert GradeThresholdsSchema(A=90.5).A == 90.5
    assert ClassCreate(name="Class", kursId="course").gradeThresholds is None
    assert ClassUpdate().gradeThresholds is None
    assert CourseUpdate().gradeThresholds is None


@pytest.mark.parametrize("schema,payload", [
    (CourseCreate, {"name": "Course", "code": "C", "subject": "Math", "description": "Test"}),
    (CourseUpdate, {}),
    (ClassCreate, {"name": "Class", "kursId": "course"}),
    (ClassUpdate, {}),
])
def test_create_and_update_schemas_validate_nested_thresholds(schema, payload):
    with pytest.raises(ValidationError):
        schema.model_validate({**payload, "gradeThresholds": {"A": 101}})
    with pytest.raises(ValidationError):
        schema.model_validate({**payload, "gradeThresholds": {"A": 70}})
    assert schema.model_validate({**payload, "gradeThresholds": {}}).gradeThresholds.model_dump() == DEFAULTS
