"""Underhållsendpoints – GDPR-sprint v1 (Vecka 2).

Ingen separat admin-roll finns i systemet idag (se docs/system-overview.md,
känd begränsning). Alla autentiserade lärare kan trigga retention-sweepen;
det är säkert eftersom sweepen bara verkställer en global tidsbaserad policy
(inga lärarspecifika data läses/ändras selektivt här) – men om multi-tenant
adminroller införs bör detta låsas till en admin-roll.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..services.retention import run_retention_sweep
from ..services.supabase_auth import SupabaseUser, get_current_supabase_user

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.post("/retention/run")
def run_retention(
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(get_current_supabase_user),
):
    """Kör retention-policyn direkt (för cron/schemaläggare eller manuell drift).

    Se app/services/retention.py för policyn:
      - Pseudonymiserar GradingResult äldre än RETENTION_ANONYMIZE_DAYS.
      - Raderar GradingResult äldre än RETENTION_HARD_DELETE_DAYS permanent.
    """
    report = run_retention_sweep(db)
    return {
        "anonymizedCount": report.anonymized_count,
        "hardDeletedCount": report.hard_deleted_count,
        "anonymizeCutoff": report.anonymize_cutoff.isoformat(),
        "hardDeleteCutoff": report.hard_delete_cutoff.isoformat(),
        "policy": {
            "retentionAnonymizeDays": settings.RETENTION_ANONYMIZE_DAYS,
            "retentionHardDeleteDays": settings.RETENTION_HARD_DELETE_DAYS,
        },
    }
