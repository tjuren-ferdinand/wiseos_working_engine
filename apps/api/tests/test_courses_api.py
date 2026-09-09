from __future__ import annotations

import sys
import uuid
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import models
from app.db import Base, get_db
from app.routers import classes, courses
from app.services.supabase_auth import SupabaseUser, get_current_supabase_user


@pytest.fixture()
def api(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'courses-api.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    current_user = {"id": "teacher-1"}

    def override_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    async def override_user():
        return SupabaseUser(id=current_user["id"], email=f"{current_user['id']}@example.com")

    app = FastAPI()
    app.include_router(classes.router)
    app.include_router(courses.router)
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_supabase_user] = override_user

    with TestClient(app) as client:
        yield client, Session, current_user

    engine.dispose()


def _course_payload():
    return {
        "name": "Fysik 2",
        "code": "FYSFYS02",
        "subject": "Fysik",
        "level": "Gymnasiet",
        "description": "Fördjupningskurs i fysik.",
        "gradeThresholds": {"A": 90, "B": 80, "C": 65, "D": 50, "E": 35, "F": 0},
    }


def test_course_crud_is_owner_scoped(api):
    client, _, current_user = api

    created = client.post("/api/v1/courses", json=_course_payload())
    assert created.status_code == 200
    body = created.json()
    uuid.UUID(body["id"])
    assert body["teacher_id"] == "teacher-1"
    assert body["gradeThresholds"]["A"] == 90
    course_id = body["id"]

    current_user["id"] = "teacher-2"
    assert client.get("/api/v1/courses").json() == []
    assert client.get(f"/api/v1/courses/{course_id}").status_code == 404
    assert client.patch(f"/api/v1/courses/{course_id}", json={"name": "Stulen"}).status_code == 404
    assert client.delete(f"/api/v1/courses/{course_id}").status_code == 404

    current_user["id"] = "teacher-1"
    updated = client.patch(
        f"/api/v1/courses/{course_id}",
        json={"name": "Fysik 2 uppdaterad", "level": None},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Fysik 2 uppdaterad"
    assert updated.json()["level"] is None
    assert client.delete(f"/api/v1/courses/{course_id}").status_code == 204
    assert client.get(f"/api/v1/courses/{course_id}").status_code == 404


def test_course_delete_conflicts_with_owned_class_reference(api):
    client, Session, _ = api
    course_id = client.post("/api/v1/courses", json=_course_payload()).json()["id"]

    with Session() as db:
        db.add(models.Klass(teacher_id="teacher-1", name="NA23", kurs_id=course_id))
        db.commit()

    response = client.delete(f"/api/v1/courses/{course_id}")
    assert response.status_code == 409
    assert client.get(f"/api/v1/courses/{course_id}").status_code == 200


def test_all_tests_returns_only_tests_for_owned_classes(api):
    client, Session, _ = api

    with Session() as db:
        owned = models.Klass(teacher_id="teacher-1", name="NA23", kurs_id="fysik2")
        other = models.Klass(teacher_id="teacher-2", name="SA23", kurs_id="matte2")
        db.add_all([owned, other])
        db.flush()
        db.add_all([
            models.Test(klass_id=owned.id, title="Owned test", questions=[]),
            models.Test(klass_id=other.id, title="Other test", questions=[]),
        ])
        db.commit()

    response = client.get("/api/v1/classes/all-tests")
    assert response.status_code == 200
    assert [test["title"] for test in response.json()] == ["Owned test"]


@pytest.mark.parametrize("resource", ["courses", "classes"])
@pytest.mark.parametrize("thresholds", [{"A": 101}, {"A": 70}, {"F": -1}])
def test_invalid_thresholds_return_422_without_changing_data(api, resource, thresholds):
    client, _, _ = api
    path = f"/api/v1/{resource}"
    payload = _course_payload() if resource == "courses" else {"name": "Class", "kursId": "course"}
    payload["gradeThresholds"] = {}
    created = client.post(path, json=payload)
    assert created.status_code == 200
    defaults = {"A": 90, "B": 80, "C": 65, "D": 50, "E": 35, "F": 0}
    assert created.json()["gradeThresholds"] == defaults
    before = client.get(path).json()
    invalid_create = client.post(path, json={**payload, "gradeThresholds": thresholds})
    assert invalid_create.status_code == 422
    invalid_update = client.patch(f"{path}/{created.json()['id']}", json={"gradeThresholds": thresholds})
    assert invalid_update.status_code == 422
    assert client.get(path).json() == before
