from __future__ import annotations

import ast
import importlib
import sys
from pathlib import Path

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import db
from app.config import settings
from app.services.supabase_auth import SupabaseUser, get_current_supabase_user


@pytest.mark.parametrize("legacy_auth_enabled", [False, True])
def test_legacy_data_routes_are_unmounted_even_with_legacy_auth(monkeypatch, legacy_auth_enabled):
    monkeypatch.setattr(settings, "ENABLE_LEGACY_AUTH", legacy_auth_enabled)
    monkeypatch.setattr(db, "init_db", lambda: None)

    def forbidden_db():
        raise AssertionError("Unmounted legacy routes must not access the database")

    monkeypatch.setattr(db.engine, "connect", forbidden_db)
    main = importlib.import_module("app.main")
    main = importlib.reload(main)
    main.app.dependency_overrides[db.get_db] = forbidden_db
    main.app.dependency_overrides[get_current_supabase_user] = lambda: SupabaseUser(id="authenticated-user")
    try:
        mounted_paths = {route.path for route in main.app.routes if isinstance(route, APIRoute)}
        assert not any(path.startswith(("/api/v1/assignments", "/api/v1/submissions")) for path in mounted_paths)
        with TestClient(main.app) as client:
            checked = 0
            for name in ("assignments", "submissions"):
                source = ast.parse((ROOT / "app" / "routers" / f"{name}.py").read_text(encoding="utf-8"))
                for node in source.body:
                    if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        continue
                    for decorator in node.decorator_list:
                        if not isinstance(decorator, ast.Call) or not isinstance(decorator.func, ast.Attribute):
                            continue
                        if not isinstance(decorator.func.value, ast.Name) or decorator.func.value.id != "router":
                            continue
                        method = decorator.func.attr.upper()
                        path = f"/api/v1/{name}" + ast.literal_eval(decorator.args[0])
                        path = path.replace("{assignment_id}", "existing-assignment").replace("{submission_id}", "existing-submission")
                        for headers in ({}, {"Authorization": "Bearer fake-authenticated-token"}):
                            response = client.request(method, path, headers=headers, json={})
                            assert response.status_code == 404, (method, path, response.text)
                        checked += 1
            assert checked >= 9
            assert not any(path.startswith(("/api/v1/assignments", "/api/v1/submissions")) for path in client.get("/openapi.json").json()["paths"])
    finally:
        monkeypatch.undo()
        importlib.reload(main)
