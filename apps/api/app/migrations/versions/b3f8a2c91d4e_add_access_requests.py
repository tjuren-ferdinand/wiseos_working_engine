"""add_access_requests

Revision ID: b3f8a2c91d4e
Revises: a41c79de2f03
Create Date: 2026-09-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3f8a2c91d4e'
down_revision: Union[str, None] = 'a41c79de2f03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'access_requests' not in set(inspector.get_table_names()):
        op.create_table(
            'access_requests',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('school', sa.String(length=255), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False),
            sa.Column('message', sa.Text(), nullable=True),
            sa.Column('status', sa.String(length=32), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('reviewed_at', sa.DateTime(), nullable=True),
            sa.Column('reviewed_by', sa.String(length=255), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_access_requests_email', 'access_requests', ['email'])


def downgrade() -> None:
    with op.batch_alter_table('access_requests', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_access_requests_email'))
    op.drop_table('access_requests')
