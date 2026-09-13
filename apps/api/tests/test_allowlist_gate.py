"""Verify the allowlist gate in get_current_supabase_user.

Mocks the outbound Supabase /auth/v1/user call so the tests run fully
isolated (no external HTTP, no real credentials).
"""
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class _FakeClient:
    def __init__(self, response: _FakeResponse):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def get(self, *args, **kwargs):
        return self._response


def _patch_supabase(monkeypatch, status_code: int, payload: dict):
    import app.services.supabase_auth as mod

    monkeypatch.setattr(mod.settings, "SUPABASE_URL", "https://supabase.test")
    monkeypatch.setattr(mod.settings, "SUPABASE_ANON_KEY", "anon")
    monkeypatch.setattr(mod.settings, "ADMIN_USER_IDS", "")
    monkeypatch.setattr(mod.settings, "ADMIN_EMAILS", "")
    monkeypatch.setattr(
        mod.httpx, "AsyncClient", lambda **kw: _FakeClient(_FakeResponse(status_code, payload))
    )


def _seed_allowlist_db(monkeypatch, tmp_path, emails):
    """Point the gate's SessionLocal at a temp-file sqlite DB seeded with emails."""
    import app.db as dbmod
    from app import models
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(
        f"sqlite:///{tmp_path}/gate.db", connect_args={"check_same_thread": False}
    )
    models.Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    session = TestSession()
    for email in emails:
        session.add(models.AllowedTeacher(email=email, created_by="test"))
    session.commit()
    session.close()
    monkeypatch.setattr(dbmod, "SessionLocal", TestSession)


async def test_non_allowlisted_user_gets_403(monkeypatch, tmp_path):
    import app.services.supabase_auth as mod

    _patch_supabase(monkeypatch, 200, {"id": "u-1", "email": "intruder@example.com"})
    _seed_allowlist_db(monkeypatch, tmp_path, ["someone-else@example.com"])

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="tok")
    with pytest.raises(HTTPException) as exc:
        await mod.get_current_supabase_user(creds)
    assert exc.value.status_code == 403


async def test_allowlisted_user_passes(monkeypatch, tmp_path):
    import app.services.supabase_auth as mod

    _patch_supabase(monkeypatch, 200, {"id": "u-2", "email": "Ok@Example.com"})
    _seed_allowlist_db(monkeypatch, tmp_path, ["ok@example.com"])

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="tok")
    user = await mod.get_current_supabase_user(creds)
    assert user.email == "Ok@Example.com"


async def test_admin_email_bypasses_gate(monkeypatch, tmp_path):
    import app.services.supabase_auth as mod

    _patch_supabase(monkeypatch, 200, {"id": "u-3", "email": "boss@example.com"})
    _seed_allowlist_db(monkeypatch, tmp_path, [])
    monkeypatch.setattr(mod.settings, "ADMIN_EMAILS", "boss@example.com")

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="tok")
    user = await mod.get_current_supabase_user(creds)
    assert user.id == "u-3"


async def test_invalid_token_gets_401(monkeypatch):
    import app.services.supabase_auth as mod

    _patch_supabase(monkeypatch, 401, {})

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="bad")
    with pytest.raises(HTTPException) as exc:
        await mod.get_current_supabase_user(creds)
    assert exc.value.status_code == 401
