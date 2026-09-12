"""Verify that admin.py is fail-closed when ADMIN_USER_IDS is empty."""
from fastapi.testclient import TestClient


def test_empty_admin_ids_rejects_authenticated_user(monkeypatch):
    from app.config import settings
    from app.services.supabase_auth import SupabaseUser, get_current_supabase_user
    from app.main import app

    # Simulate empty ADMIN_USER_IDS and no Supabase role
    monkeypatch.setattr(settings, "ADMIN_USER_IDS", "")
    fake_user = SupabaseUser(id="teacher-123", email="t@example.com", role=None)
    app.dependency_overrides[get_current_supabase_user] = lambda: fake_user

    client = TestClient(app)
    resp = client.post("/api/v1/admin/retention/run")
    assert resp.status_code == 403
    app.dependency_overrides.clear()


def test_admin_id_in_list_grants_access(monkeypatch):
    from app.config import settings
    from app.services.supabase_auth import SupabaseUser, get_current_supabase_user
    from app.main import app

    monkeypatch.setattr(settings, "ADMIN_USER_IDS", "teacher-123")
    fake_user = SupabaseUser(id="teacher-123", email="t@example.com", role=None)
    app.dependency_overrides[get_current_supabase_user] = lambda: fake_user

    with TestClient(app) as client:
        resp = client.post("/api/v1/admin/retention/run")
    assert resp.status_code == 200
    app.dependency_overrides.clear()


def test_supabase_admin_role_grants_access(monkeypatch):
    from app.config import settings
    from app.services.supabase_auth import SupabaseUser, get_current_supabase_user
    from app.main import app

    monkeypatch.setattr(settings, "ADMIN_USER_IDS", "")
    fake_user = SupabaseUser(id="teacher-123", email="t@example.com", role="admin")
    app.dependency_overrides[get_current_supabase_user] = lambda: fake_user

    with TestClient(app) as client:
        resp = client.post("/api/v1/admin/retention/run")
    assert resp.status_code == 200
    app.dependency_overrides.clear()


def test_admin_email_grants_access(monkeypatch):
    """ADMIN_EMAILS är ägundantaget — e-postmatchning ger admin även om
    användarens UUID inte står i ADMIN_USER_IDS."""
    from app.config import settings
    from app.services.supabase_auth import SupabaseUser, get_current_supabase_user
    from app.main import app

    monkeypatch.setattr(settings, "ADMIN_USER_IDS", "")
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "Owner@Example.com")
    fake_user = SupabaseUser(id="new-uuid-999", email="owner@example.com", role=None)
    app.dependency_overrides[get_current_supabase_user] = lambda: fake_user

    with TestClient(app) as client:
        resp = client.post("/api/v1/admin/retention/run")
    assert resp.status_code == 200
    app.dependency_overrides.clear()


def test_non_admin_email_still_rejected(monkeypatch):
    """E-post som inte står i ADMIN_EMAILS ger 403 — fail-closed."""
    from app.config import settings
    from app.services.supabase_auth import SupabaseUser, get_current_supabase_user
    from app.main import app

    monkeypatch.setattr(settings, "ADMIN_USER_IDS", "")
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "owner@example.com")
    fake_user = SupabaseUser(id="teacher-123", email="other@example.com", role=None)
    app.dependency_overrides[get_current_supabase_user] = lambda: fake_user

    client = TestClient(app)
    resp = client.post("/api/v1/admin/retention/run")
    assert resp.status_code == 403
    app.dependency_overrides.clear()
