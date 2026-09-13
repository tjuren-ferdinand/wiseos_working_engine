"""Underhållsendpoints – GDPR-sprint v1 (Vecka 2).

Ingen separat admin-roll finns i systemet idag (se docs/system-overview.md,
känd begränsning). Alla autentiserade lärare kan trigga retention-sweepen;
det är säkert eftersom sweepen bara verkställer en global tidsbaserad policy
(inga lärarspecifika data läses/ändras selektivt här) – men om multi-tenant
adminroller införs bör detta låsas till en admin-roll.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings
from ..db import get_db
from ..services.retention import run_retention_sweep
from ..services.supabase_auth import SupabaseUser, get_current_supabase_user

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


async def require_admin(
    user: SupabaseUser = Depends(get_current_supabase_user),
) -> SupabaseUser:
    """Fail-closed admin gate.

    Access is granted ONLY if:
      - user.id is in settings.admin_user_ids (from ADMIN_USER_IDS env var), OR
      - user.role == "admin" (from Supabase JWT).

    If ADMIN_USER_IDS is empty/unset AND Supabase does not set role="admin",
    this returns 403 for EVERY authenticated user. That is the intended
    behavior — no silent admin access.
    """
    if user.id in settings.admin_user_ids or user.role == "admin":
        return user
    raise HTTPException(403, "Admin access required")


@router.post("/retention/run")
def run_retention(
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(require_admin),
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


# ---------------------------------------------------------------------------
# Allowlist — lärare som får använda appen (Spår 3.2)
# ---------------------------------------------------------------------------


@router.get("/allowlist", response_model=list[schemas.AllowedTeacherOut])
def list_allowlist(
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(require_admin),
):
    """Lista alla godkända lärare — admin only."""
    return db.query(models.AllowedTeacher).order_by(models.AllowedTeacher.created_at.desc()).all()


@router.post("/allowlist", response_model=schemas.AllowedTeacherOut, status_code=201)
def add_to_allowlist(
    payload: schemas.AllowlistAdd,
    db: Session = Depends(get_db),
    user: SupabaseUser = Depends(require_admin),
):
    """Lägg till en lärare i allowlisten — admin only."""
    email = payload.email.strip().lower()
    existing = db.query(models.AllowedTeacher).filter(models.AllowedTeacher.email == email).first()
    if existing:
        raise HTTPException(409, f"{email} är redan godkänd")
    record = models.AllowedTeacher(email=email, created_by=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/allowlist/{email}", status_code=204)
def remove_from_allowlist(
    email: str,
    db: Session = Depends(get_db),
    _user: SupabaseUser = Depends(require_admin),
):
    """Ta bort en lärare från allowlisten — admin only."""
    record = db.query(models.AllowedTeacher).filter(
        models.AllowedTeacher.email == email.strip().lower()
    ).first()
    if not record:
        raise HTTPException(404, f"{email} finns inte i allowlisten")
    db.delete(record)
    db.commit()
