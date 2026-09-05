"""add_performance_indexes

Revision ID: e889d11880ea
Revises: 6d18e944fa4c
Create Date: 2026-09-05 13:50:00.000000

Adds 4 missing indexes discovered via PRAGMA inspection of wiseos.db.
All are simple CREATE INDEX — no table rebuild, no data modification.

NOT included: grading_results.student_id -> students.id FK constraint.
The model declares ondelete="SET NULL" but classes.py:delete_student
hard-deletes GradingResult rows instead — semantically incompatible.
See models.py KNOWN-ISSUE comment and plan-3766349cb86fba8f.md.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e889d11880ea'
down_revision: Union[str, None] = '6d18e944fa4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # ix_tests_klass_id — FK lookups when listing tests per class.
    if "ix_tests_klass_id" not in {i["name"] for i in inspector.get_indexes("tests")}:
        op.create_index("ix_tests_klass_id", "tests", ["klass_id"])

    # ix_students_klass_id — FK lookups when listing students per class.
    if "ix_students_klass_id" not in {i["name"] for i in inspector.get_indexes("students")}:
        op.create_index("ix_students_klass_id", "students", ["klass_id"])

    # ix_grading_results_scanned_at — retention sweep filters on scanned_at
    # (services/retention.py lines ~61, ~83).
    if "ix_grading_results_scanned_at" not in {i["name"] for i in inspector.get_indexes("grading_results")}:
        op.create_index("ix_grading_results_scanned_at", "grading_results", ["scanned_at"])

    # ix_grading_results_student_id — declared index=True in the model
    # (models.py:161) but never created in the existing DB.
    if "ix_grading_results_student_id" not in {i["name"] for i in inspector.get_indexes("grading_results")}:
        op.create_index("ix_grading_results_student_id", "grading_results", ["student_id"])


def downgrade() -> None:
    op.drop_index("ix_tests_klass_id", table_name="tests")
    op.drop_index("ix_students_klass_id", table_name="students")
    op.drop_index("ix_grading_results_scanned_at", table_name="grading_results")
    op.drop_index("ix_grading_results_student_id", table_name="grading_results")
