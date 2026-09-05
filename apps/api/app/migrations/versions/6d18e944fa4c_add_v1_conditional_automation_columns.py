"""add_v1_conditional_automation_columns

Revision ID: 6d18e944fa4c
Revises: c6c4ebf10225
Create Date: 2026-09-05 13:45:00.000000

Idempotent backfill for databases that pre-date the baseline migration.
All columns already exist in the baseline schema — this revision is a no-op
on fresh databases and only fills gaps on old databases that were created
before Alembic was introduced.

Mirrors the ad-hoc ALTER TABLE logic previously in app/db.py init_db().
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6d18e944fa4c'
down_revision: Union[str, None] = 'c6c4ebf10225'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Columns that older databases may be missing. Each entry is checked against
# the actual table before ALTER TABLE is issued — fully idempotent.
_COLUMNS: dict[str, list[tuple[str, str]]] = {
    "submissions": [
        ("student_pseudonym", "VARCHAR(32)"),
        ("ocr_confidence", "FLOAT"),
        ("wolfram_confidence", "FLOAT"),
        ("confidence_overall", "FLOAT"),
        ("requires_review", "BOOLEAN DEFAULT 0"),
        ("review_status", "VARCHAR(32) DEFAULT 'auto_approved'"),
        ("reviewed_by", "VARCHAR(255)"),
        ("reviewed_at", "DATETIME"),
        ("final_feedback", "TEXT"),
        ("final_score", "INTEGER"),
    ],
    "teachers": [("user_id", "VARCHAR(36)")],
    "classes": [("teacher_id", "VARCHAR(255)")],
    "grading_results": [
        ("identification_method", "VARCHAR(32) DEFAULT 'unresolved'"),
        ("identification_confidence", "FLOAT DEFAULT 0"),
        ("scan_pages", "JSON"),
        ("document", "JSON"),
        ("anonymized_at", "DATETIME"),
    ],
}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    for table, columns in _COLUMNS.items():
        if table not in tables:
            continue
        existing = {c["name"] for c in inspector.get_columns(table)}
        for column, definition in columns:
            if column not in existing:
                op.execute(sa.text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))


def downgrade() -> None:
    # No-op: dropping columns risks data loss on databases that had them
    # before this revision existed. Downgrade is intentionally a pass.
    pass
