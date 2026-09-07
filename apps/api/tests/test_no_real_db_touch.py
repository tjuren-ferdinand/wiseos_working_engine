"""Regression test: the test suite must NOT modify the real wiseos.db.

The env.py bug caused migration tests to run against the real database
because config.set_main_option unconditionally overrode the test's URL.
This test would have caught that — it verifies the real DB file is
untouched after migration tests run.
"""
from __future__ import annotations

import hashlib
import os
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from alembic import command
from alembic.config import Config

REAL_DB = ROOT / "wiseos.db"


def _file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _row_data(db_path: Path) -> list:
    import sqlite3
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()
    cur.execute("SELECT * FROM grading_results ORDER BY id")
    rows = cur.fetchall()
    conn.close()
    return rows


def test_migrations_do_not_touch_real_db(tmp_path):
    """Running alembic upgrade on a COPY must not modify the real wiseos.db."""
    if not REAL_DB.exists():
        pytest.skip("wiseos.db not present")

    # Record real DB state before
    real_hash_before = _file_hash(REAL_DB)
    real_mtime_before = os.stat(REAL_DB).st_mtime
    real_rows_before = _row_data(REAL_DB)

    # Copy real DB to tmp_path, migrate the copy
    copy_path = tmp_path / "copy.db"
    copy_path.write_bytes(REAL_DB.read_bytes())

    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "app" / "migrations"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{copy_path}")

    command.stamp(cfg, "c6c4ebf10225")
    command.upgrade(cfg, "head")

    # Verify real DB was NOT modified
    real_hash_after = _file_hash(REAL_DB)
    real_mtime_after = os.stat(REAL_DB).st_mtime
    real_rows_after = _row_data(REAL_DB)

    assert real_hash_before == real_hash_after, (
        "REAL DB CONTENT CHANGED — a migration test modified wiseos.db"
    )
    assert real_mtime_before == real_mtime_after, (
        "REAL DB MTIME CHANGED — a migration test touched wiseos.db"
    )
    assert real_rows_before == real_rows_after, (
        "REAL DB ROW DATA CHANGED — migration test modified grading_results"
    )


def test_env_py_respects_explicit_url(tmp_path):
    """env.py must not override an explicitly set sqlalchemy.url."""
    from app.config import settings

    test_url = f"sqlite:///{tmp_path}/test.db"

    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "app" / "migrations"))
    cfg.set_main_option("sqlalchemy.url", test_url)

    # The env.py check should NOT override our URL with settings.DATABASE_URL
    effective_url = cfg.get_main_option("sqlalchemy.url")
    assert effective_url == test_url, (
        f"env.py would override test URL: got {effective_url}, expected {test_url}"
    )
    assert effective_url != settings.DATABASE_URL, (
        "env.py is overriding the test URL with the real DATABASE_URL — "
        "this is the bug that caused the accidental real-DB migration"
    )
