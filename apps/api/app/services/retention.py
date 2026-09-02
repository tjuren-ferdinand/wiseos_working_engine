"""GDPR-sprint v1 (Vecka 2) – retention-sweep för GradingResult.

Policy:
  * Dag 0–30:  full data (elevnamn, transkription, feedback) – läraren
    behöver detta för att kunna granska/rätta/kommunicera med eleven.
  * Dag 30+:   identitet pseudonymiseras (student_name -> "Elev #XXXX",
    student_id nollställs). Pedagogiskt innehåll (poäng, feedback,
    transkription) behålls eftersom det inte längre är kopplat till en
    identifierbar individ.
  * Dag 90+:   raden raderas helt (hard delete) – inget kvar.

Detta är MEDVETET separat från Klass/Test/KlassStudent, som är lärarens
egna organisatoriska data och inte har någon automatisk utgångstid – de
raderas bara explicit av läraren (se DELETE-endpoints i routers/classes.py
och routers/results.py).

Körs via:
  * POST /api/v1/admin/retention/run  (se routers/admin.py)
  * scripts/run_retention.py           (för cron/schemaläggare)

Ingen bakgrundsschemaläggare finns inbyggd i appen – detta är en
medveten avgränsning för nuvarande skala. Se docs/system-overview.md.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from .. import models
from ..config import settings
from .anonymize import pseudonymize_student

logger = logging.getLogger("wiseos.retention")


@dataclass
class RetentionReport:
    anonymized_count: int
    hard_deleted_count: int
    anonymize_cutoff: datetime
    hard_delete_cutoff: datetime


def anonymize_stale_results(db: Session, *, now: datetime | None = None) -> int:
    """Pseudonymiserar identitet på GradingResult äldre än RETENTION_ANONYMIZE_DAYS.

    Rör INTE rader som redan är anonymiserade (anonymized_at IS NOT NULL)
    eller som är så gamla att de ändå raderas av hard-delete-steget.
    """
    now = now or datetime.utcnow()
    anonymize_cutoff = now - timedelta(days=settings.RETENTION_ANONYMIZE_DAYS)
    hard_delete_cutoff = now - timedelta(days=settings.RETENTION_HARD_DELETE_DAYS)

    stale = (
        db.query(models.GradingResult)
        .filter(
            models.GradingResult.anonymized_at.is_(None),
            models.GradingResult.scanned_at < anonymize_cutoff,
            models.GradingResult.scanned_at >= hard_delete_cutoff,
        )
        .all()
    )
    for result in stale:
        result.student_name = pseudonymize_student(result.student_name or result.id)
        result.student_id = None
        result.anonymized_at = now
    if stale:
        db.commit()
    logger.info("retention_anonymize count=%d cutoff=%s", len(stale), anonymize_cutoff.isoformat())
    return len(stale)


def hard_delete_stale_results(db: Session, *, now: datetime | None = None) -> int:
    """Raderar GradingResult äldre än RETENTION_HARD_DELETE_DAYS permanent."""
    now = now or datetime.utcnow()
    hard_delete_cutoff = now - timedelta(days=settings.RETENTION_HARD_DELETE_DAYS)

    stale = (
        db.query(models.GradingResult)
        .filter(models.GradingResult.scanned_at < hard_delete_cutoff)
        .all()
    )
    count = len(stale)
    for result in stale:
        db.delete(result)
    if stale:
        db.commit()
    logger.info("retention_hard_delete count=%d cutoff=%s", count, hard_delete_cutoff.isoformat())
    return count


def run_retention_sweep(db: Session) -> RetentionReport:
    """Kör hela retention-policyn i rätt ordning: hard delete FÖRST (annars
    skulle anonymize-steget i onödan pseudonymisera rader som ändå raderas
    i samma svep – ren optimering, inte ett korrekthetskrav)."""
    now = datetime.utcnow()
    hard_deleted = hard_delete_stale_results(db, now=now)
    anonymized = anonymize_stale_results(db, now=now)
    return RetentionReport(
        anonymized_count=anonymized,
        hard_deleted_count=hard_deleted,
        anonymize_cutoff=now - timedelta(days=settings.RETENTION_ANONYMIZE_DAYS),
        hard_delete_cutoff=now - timedelta(days=settings.RETENTION_HARD_DELETE_DAYS),
    )
