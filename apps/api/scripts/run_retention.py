"""GDPR-sprint v1 (Vecka 2) – manuell/schemalagd körning av retention-sweepen.

Tänkt att köras via cron (Linux) eller Windows Task Scheduler, t.ex. dagligen.
Kan även köras manuellt för att verifiera policyn.

Kör så:
    cd apps/api
    .\.venv\Scripts\python.exe scripts\run_retention.py

Policy (se app/services/retention.py och app/config.py):
    RETENTION_ANONYMIZE_DAYS  (default 30) – pseudonymiserar elevnamn/id.
    RETENTION_HARD_DELETE_DAYS (default 90) – raderar raden helt.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.config import settings  # noqa: E402
from app.db import SessionLocal, init_db  # noqa: E402
from app.services.retention import run_retention_sweep  # noqa: E402


def main() -> None:
    print("[CHECKPOINT] initierar databas...", flush=True)
    init_db()
    print(
        f"[CHECKPOINT] policy: anonymize>{settings.RETENTION_ANONYMIZE_DAYS}d, "
        f"hard_delete>{settings.RETENTION_HARD_DELETE_DAYS}d",
        flush=True,
    )

    db = SessionLocal()
    try:
        print("[CHECKPOINT] kör retention-sweep...", flush=True)
        report = run_retention_sweep(db)
    finally:
        db.close()

    print("\n=== RETENTION-RAPPORT ===")
    print(f"  Pseudonymiserade rader (>{settings.RETENTION_ANONYMIZE_DAYS}d): {report.anonymized_count}")
    print(f"  Raderade rader (>{settings.RETENTION_HARD_DELETE_DAYS}d):       {report.hard_deleted_count}")
    print(f"  Anonymize cutoff:  {report.anonymize_cutoff.isoformat()}")
    print(f"  Hard delete cutoff: {report.hard_delete_cutoff.isoformat()}")
    print("[CHECKPOINT] klar", flush=True)


if __name__ == "__main__":
    main()
