from __future__ import annotations

import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import models, schemas
from app.db import Base, get_db
from app.routers import batch, ocr
from app.services import rate_limits
from app.services.supabase_auth import SupabaseUser, get_current_supabase_user


@pytest.fixture()
def api(monkeypatch):
    now = [100.0]
    monkeypatch.setattr(rate_limits, "batch_grade_limiter", rate_limits.UserRateLimiter(clock=lambda: now[0]))
    monkeypatch.setattr(rate_limits, "answer_key_generate_limiter", rate_limits.UserRateLimiter(clock=lambda: now[0]))
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False)
    with Session() as db:
        for user_id in ("teacher-1", "teacher-2"):
            klass = models.Klass(id=f"klass-{user_id}", teacher_id=user_id, name="Test", kurs_id="test")
            db.add(klass)
            db.flush()
            db.add(models.Test(id=f"test-{user_id}", klass_id=klass.id, title="Test", questions=[]))
        db.commit()

    db_calls = []

    def override_db():
        db_calls.append(True)
        with Session() as db:
            yield db

    async def override_user(request: Request):
        user_id = request.headers.get("X-Test-User")
        if not user_id:
            raise HTTPException(401, "Unauthenticated")
        return SupabaseUser(id=user_id)

    grade = AsyncMock(return_value=[])
    generate = AsyncMock(return_value=[schemas.AnswerKeyItem(question_number="1", question_text="Q", final_answer="A")])
    monkeypatch.setattr(batch, "grade_batch", grade)
    monkeypatch.setattr(ocr, "generate_answer_key", generate)
    monkeypatch.setattr(batch, "integration_status", lambda: {})
    app = FastAPI()
    app.include_router(batch.router)
    app.include_router(ocr.router)
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_supabase_user] = override_user
    with TestClient(app) as client:
        yield client, now, grade, generate, db_calls
    engine.dispose()


def _post(client, endpoint, user="teacher-1", token="first-token"):
    headers = {"Authorization": f"Bearer {token}", "X-Forwarded-For": token}
    if user:
        headers["X-Test-User"] = user
    if endpoint == "batch":
        return client.post(
            "/api/v1/batch/grade", headers=headers,
            data={"prov_id": f"test-{user}"},
            files={"files": ("student.png", b"fake image", "image/png")},
        )
    return client.post("/api/v1/ocr/answer-key/generate", headers=headers, data={"description": "Test"})


@pytest.mark.parametrize("endpoint", ["batch", "generate"])
def test_ten_per_user_per_minute_before_provider_or_db(api, endpoint):
    client, now, grade, generate, db_calls = api
    provider = grade if endpoint == "batch" else generate
    for number in range(10):
        assert _post(client, endpoint, token=str(number)).status_code == 200
    assert provider.await_count == 10
    before_db = len(db_calls)
    rejected = _post(client, endpoint, token="rotated-token")
    assert rejected.status_code == 429
    assert rejected.headers["Retry-After"] == "60"
    assert provider.await_count == 10
    assert len(db_calls) == before_db
    assert _post(client, endpoint, user="teacher-2").status_code == 200
    now[0] += 59.1
    rejected = _post(client, endpoint)
    assert rejected.status_code == 429
    assert rejected.headers["Retry-After"] == "1"
    now[0] += 0.9
    assert _post(client, endpoint).status_code == 200


def test_endpoint_budgets_are_independent(api):
    client, _, grade, generate, _ = api
    for _ in range(10):
        assert _post(client, "batch").status_code == 200
    assert _post(client, "batch").status_code == 429
    assert _post(client, "generate").status_code == 200
    assert grade.await_count == 10
    assert generate.await_count == 1


@pytest.mark.parametrize("endpoint", ["batch", "generate"])
def test_unauthenticated_requests_do_not_consume_quota(api, endpoint):
    client, _, grade, generate, db_calls = api
    for _ in range(11):
        assert _post(client, endpoint, user=None).status_code == 401
    assert not db_calls
    assert grade.await_count == generate.await_count == 0
    for _ in range(10):
        assert _post(client, endpoint).status_code == 200


def test_sliding_window_does_not_reset_at_minute_boundary():
    now = [0.0]
    limiter = rate_limits.UserRateLimiter(clock=lambda: now[0])
    for _ in range(5):
        limiter.check("user")
    now[0] = 30.0
    for _ in range(5):
        limiter.check("user")
    now[0] = 60.0
    for _ in range(5):
        limiter.check("user")
    with pytest.raises(HTTPException) as error:
        limiter.check("user")
    assert error.value.status_code == 429
    assert error.value.headers["Retry-After"] == "30"


def test_concurrent_requests_cannot_exceed_limit():
    limiter = rate_limits.UserRateLimiter(clock=lambda: 100.0)

    def attempt(_):
        try:
            limiter.check("same-user")
            return 200
        except HTTPException as error:
            return error.status_code

    with ThreadPoolExecutor(max_workers=32) as pool:
        statuses = list(pool.map(attempt, range(100)))
    assert statuses.count(200) == 10
    assert statuses.count(429) == 90


def test_capacity_is_bounded_without_evicting_active_users():
    now = [0.0]
    limiter = rate_limits.UserRateLimiter(max_users=2, clock=lambda: now[0])
    for _ in range(10):
        limiter.check("first")
    now[0] = 1.0
    limiter.check("second")
    for index in range(100):
        with pytest.raises(HTTPException) as error:
            limiter.check(f"overflow-{index}")
        assert error.value.status_code == 429
        assert error.value.headers["Retry-After"] == "59"
        assert len(limiter._requests) == 2
    with pytest.raises(HTTPException):
        limiter.check("first")
    now[0] = 60.0
    limiter.check("new-user")
    assert len(limiter._requests) == 2
    now[0] = 121.0
    limiter.check("fresh")
    assert len(limiter._requests) == 1


def test_expiry_tracks_latest_accepted_request():
    now = [0.0]
    limiter = rate_limits.UserRateLimiter(max_users=2, clock=lambda: now[0])
    limiter.check("first")
    now[0] = 1.0
    limiter.check("second")
    now[0] = 50.0
    limiter.check("first")
    now[0] = 61.0
    limiter.check("third")
    assert len(limiter._requests) == 2
    for _ in range(9):
        limiter.check("first")
    with pytest.raises(HTTPException) as error:
        limiter.check("first")
    assert error.value.headers["Retry-After"] == "49"
