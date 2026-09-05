"""Migration tests — Alembic baseline + performance indexes.

Runs against fresh in-memory/file SQLite databases and a COPY of wiseos.db.
Never touches the real wiseos.db.
"""
from __future__ import annotations

import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from alembic import command
from alembic.config import Config

from app.db import Base
from app import models  # noqa: F401

ALEMBIC_INI = ROOT / "alembic.ini"


def _alembic_cfg(db_url: str) -> Config:
    cfg = Config(str(ALEMBIC_INI))
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


def _tables(db_path: Path) -> set[str]:
    conn = sqlite3.connect(str(db_path))
    try:
        return {
            r[0]
            for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'alembic_version'"
            )
        }
    finally:
        conn.close()


def _indexes(db_path: Path, table: str) -> set[str]:
    conn = sqlite3.connect(str(db_path))
    try:
        return {r[1] for r in conn.execute(f"PRAGMA index_list({table})")}
    finally:
        conn.close()


def _fks(db_path: Path, table: str) -> list[tuple]:
    conn = sqlite3.connect(str(db_path))
    try:
        return [tuple(r) for r in conn.execute(f"PRAGMA foreign_key_list({table})")]
    finally:
        conn.close()


def _columns(db_path: Path, table: str) -> set[str]:
    conn = sqlite3.connect(str(db_path))
    try:
        return {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Baseline tests (fresh database)
# ---------------------------------------------------------------------------


def test_baseline_creates_all_tables(tmp_path):
    db = tmp_path / "fresh.db"
    cfg = _alembic_cfg(f"sqlite:///{db}")
    command.upgrade(cfg, "head")

    expected = {
        "users", "teachers", "assignments", "submissions",
        "classes", "students", "tests", "grading_results", "answer_keys",
    }
    assert _tables(db) == expected


def test_baseline_includes_v1_tables(tmp_path):
    """V1 tables are orphaned but still in the schema — baseline must create them."""
    db = tmp_path / "fresh.db"
    cfg = _alembic_cfg(f"sqlite:///{db}")
    command.upgrade(cfg, "head")

    tables = _tables(db)
    assert "assignments" in tables
    assert "submissions" in tables
    # Spot-check V1 columns survive in the baseline
    assert "grade_level" in _columns(db, "assignments")
    assert "student_pseudonym" in _columns(db, "submissions")


def test_baseline_tests_table_has_facit_column(tmp_path):
    """tests.facit exists in the real DB but not the model — baseline includes
    it so fresh DBs match reality (documented drift decision, Option A)."""
    db = tmp_path / "fresh.db"
    cfg = _alembic_cfg(f"sqlite:///{db}")
    command.upgrade(cfg, "head")

    assert "facit" in _columns(db, "tests")


def test_indexes_exist_after_upgrade(tmp_path):
    db = tmp_path / "fresh.db"
    cfg = _alembic_cfg(f"sqlite:///{db}")
    command.upgrade(cfg, "head")

    assert "ix_tests_klass_id" in _indexes(db, "tests")
    assert "ix_students_klass_id" in _indexes(db, "students")
    assert "ix_grading_results_scanned_at" in _indexes(db, "grading_results")
    assert "ix_grading_results_student_id" in _indexes(db, "grading_results")


def test_student_id_fk_present_on_fresh_create_all(tmp_path):
    """On a fresh DB via create_all, the student_id FK IS present — the model
    defines it. This documents that the FK gap is specific to existing DBs."""
    from sqlalchemy import create_engine

    db = tmp_path / "fresh_create_all.db"
    engine = create_engine(f"sqlite:///{db}")
    Base.metadata.create_all(engine)
    engine.dispose()

    fks = _fks(db, "grading_results")
    fk_targets = {(fk[2], fk[3], fk[4]) for fk in fks}  # (table, from, to)
    assert ("students", "student_id", "id") in fk_targets


# ---------------------------------------------------------------------------
# Existing wiseos.db — copy test (never touches the real file)
# ---------------------------------------------------------------------------


def test_index_migration_preserves_real_data(tmp_path):
    """Copy wiseos.db, stamp at baseline, upgrade head, verify data intact."""
    real_db = ROOT / "wiseos.db"
    if not real_db.exists():
        pytest.skip("wiseos.db not present — nothing to verify against")

    copy_db = tmp_path / "wiseos_copy.db"
    shutil.copy2(real_db, copy_db)

    # Snapshot pre-migration rows
    conn = sqlite3.connect(str(copy_db))
    pre_rows = conn.execute(
        "SELECT id, test_id, student_name, student_id, total_score, max_score, steps FROM grading_results ORDER BY id"
    ).fetchall()
    conn.close()
    assert len(pre_rows) == 12, f"expected 12 grading_results, got {len(pre_rows)}"

    # Stamp at baseline, then upgrade head (adds only indexes — no data change)
    cfg = _alembic_cfg(f"sqlite:///{copy_db}")
    command.stamp(cfg, "c6c4ebf10225")
    command.upgrade(cfg, "head")

    conn = sqlite3.connect(str(copy_db))
    post_rows = conn.execute(
        "SELECT id, test_id, student_name, student_id, total_score, max_score, steps FROM grading_results ORDER BY id"
    ).fetchall()
    conn.close()

    assert pre_rows == post_rows, "grading_results data changed during index migration"

    # All 4 planned indexes now exist
    assert "ix_tests_klass_id" in _indexes(copy_db, "tests")
    assert "ix_students_klass_id" in _indexes(copy_db, "students")
    assert "ix_grading_results_scanned_at" in _indexes(copy_db, "grading_results")
    assert "ix_grading_results_student_id" in _indexes(copy_db, "grading_results")


def test_student_id_fk_not_added_on_sqlite(tmp_path):
    """The student_id FK is intentionally NOT added to existing SQLite DBs —
    classes.py:delete_student hard-deletes GradingResults, which conflicts
    with ondelete="SET NULL". This test documents that decision."""
    real_db = ROOT / "wiseos.db"
    if not real_db.exists():
        pytest.skip("wiseos.db not present — nothing to verify against")

    copy_db = tmp_path / "wiseos_copy2.db"
    shutil.copy2(real_db, copy_db)

    cfg = _alembic_cfg(f"sqlite:///{copy_db}")
    command.stamp(cfg, "c6c4ebf10225")
    command.upgrade(cfg, "head")

    fks = _fks(copy_db, "grading_results")
    fk_targets = {(fk[2], fk[3], fk[4]) for fk in fks}
    # test_id FK exists (was created in original CREATE TABLE)
    assert ("tests", "test_id", "id") in fk_targets
    # student_id FK is NOT present — intentionally not added on existing SQLite
    assert ("students", "student_id", "id") not in fk_targets
