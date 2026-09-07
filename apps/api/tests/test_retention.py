"""GDPR-sprint v1 (Vecka 2) – regressionstest för retention-sweepen.

Kör helt isolerat mot en in-memory SQLite-databas (rör ALDRIG wiseos.db).
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.db import Base
from app.services.retention import (
    anonymize_stale_results,
    hard_delete_stale_results,
    run_retention_sweep,
)


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    session = Session()
    yield session
    session.close()


def _make_class_with_test(db, teacher_id="teacher-1"):
    klass = models.Klass(teacher_id=teacher_id, name="Klass A", kurs_id="fysik1")
    db.add(klass)
    db.flush()
    test = models.Test(klass_id=klass.id, title="Prov 1")
    db.add(test)
    db.flush()
    return klass, test


def _make_result(db, test_id, *, scanned_at, student_name="Anna Svensson", student_id="stud-1"):
    result = models.GradingResult(
        test_id=test_id,
        student_name=student_name,
        student_id=student_id,
        scanned_at=scanned_at,
        steps=[],
        feedback="Bra jobbat!",
    )
    db.add(result)
    db.flush()
    return result


def test_fresh_result_untouched(db_session):
    """Resultat under 30 dagar ska INTE anonymiseras eller raderas."""
    _, test = _make_class_with_test(db_session)
    fresh = _make_result(db_session, test.id, scanned_at=datetime.utcnow() - timedelta(days=5))
    db_session.commit()

    report = run_retention_sweep(db_session)

    assert report.anonymized_count == 0
    assert report.hard_deleted_count == 0
    refreshed = db_session.get(models.GradingResult, fresh.id)
    assert refreshed is not None
    assert refreshed.student_name == "Anna Svensson"
    assert refreshed.anonymized_at is None


def test_result_between_30_and_90_days_is_anonymized(db_session):
    """Mellan 30 och 90 dagar: identitet pseudonymiseras, raden finns kvar."""
    _, test = _make_class_with_test(db_session)
    mid = _make_result(db_session, test.id, scanned_at=datetime.utcnow() - timedelta(days=45))
    db_session.commit()

    count = anonymize_stale_results(db_session)

    assert count == 1
    refreshed = db_session.get(models.GradingResult, mid.id)
    assert refreshed is not None
    assert refreshed.student_name != "Anna Svensson"
    assert refreshed.student_name.startswith("Elev #")
    assert refreshed.student_id is None
    assert refreshed.anonymized_at is not None
    # Pedagogiskt innehåll ska INTE röras vid anonymisering.
    assert refreshed.feedback == "Bra jobbat!"


def test_result_over_90_days_is_hard_deleted(db_session):
    """Över 90 dagar: raden raderas helt, inget kvar i DB."""
    _, test = _make_class_with_test(db_session)
    old = _make_result(db_session, test.id, scanned_at=datetime.utcnow() - timedelta(days=120))
    db_session.commit()
    old_id = old.id

    count = hard_delete_stale_results(db_session)

    assert count == 1
    assert db_session.get(models.GradingResult, old_id) is None


def test_full_sweep_handles_mixed_ages_correctly(db_session):
    """En sweep med tre rader i olika åldrar ska hantera var och en korrekt."""
    _, test = _make_class_with_test(db_session)
    fresh = _make_result(db_session, test.id, scanned_at=datetime.utcnow() - timedelta(days=5), student_id="s-fresh")
    mid = _make_result(db_session, test.id, scanned_at=datetime.utcnow() - timedelta(days=45), student_id="s-mid")
    old = _make_result(db_session, test.id, scanned_at=datetime.utcnow() - timedelta(days=120), student_id="s-old")
    db_session.commit()

    report = run_retention_sweep(db_session)

    assert report.hard_deleted_count == 1
    assert report.anonymized_count == 1

    assert db_session.get(models.GradingResult, fresh.id).student_id == "s-fresh"
    assert db_session.get(models.GradingResult, mid.id).student_id is None
    assert db_session.get(models.GradingResult, old.id) is None


def test_already_anonymized_result_is_not_touched_twice(db_session):
    """En redan pseudonymiserad rad (anonymized_at satt) ska inte behandlas igen."""
    _, test = _make_class_with_test(db_session)
    result = _make_result(db_session, test.id, scanned_at=datetime.utcnow() - timedelta(days=45))
    result.student_name = "Elev #ABCD"
    result.student_id = None
    result.anonymized_at = datetime.utcnow() - timedelta(days=10)
    db_session.commit()

    count = anonymize_stale_results(db_session)

    assert count == 0
    refreshed = db_session.get(models.GradingResult, result.id)
    assert refreshed.student_name == "Elev #ABCD"
