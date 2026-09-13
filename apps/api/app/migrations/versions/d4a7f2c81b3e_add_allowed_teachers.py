"""add_allowed_teachers

Revision ID: d4a7f2c81b3e
Revises: b3f8a2c91d4e
Create Date: 2026-09-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4a7f2c81b3e'
down_revision: Union[str, None] = 'b3f8a2c91d4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'allowed_teachers' not in set(inspector.get_table_names()):
        op.create_table(
            'allowed_teachers',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False),
            sa.Column('supabase_user_id', sa.String(length=255), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('created_by', sa.String(length=255), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('email'),
        )
        op.create_index('ix_allowed_teachers_email', 'allowed_teachers', ['email'])
        op.create_index('ix_allowed_teachers_supabase_user_id', 'allowed_teachers', ['supabase_user_id'])


def downgrade() -> None:
    with op.batch_alter_table('allowed_teachers', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_allowed_teachers_supabase_user_id'))
        batch_op.drop_index(batch_op.f('ix_allowed_teachers_email'))
    op.drop_table('allowed_teachers')
