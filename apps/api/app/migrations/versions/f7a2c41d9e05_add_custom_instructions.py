"""add_custom_instructions_to_grading_results

Elevspecifika AI-premisser — lärarens instruktioner som läggs till i
grading_notes vid om-rättning av ett enskilt resultat.

Revision ID: f7a2c41d9e05
Revises: d4a7f2c81b3e
Create Date: 2026-09-15 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7a2c41d9e05'
down_revision: Union[str, None] = 'd4a7f2c81b3e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'custom_instructions' not in {
        c['name'] for c in inspector.get_columns('grading_results')
    }:
        with op.batch_alter_table('grading_results', schema=None) as batch_op:
            batch_op.add_column(sa.Column('custom_instructions', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('grading_results', schema=None) as batch_op:
        batch_op.drop_column('custom_instructions')
