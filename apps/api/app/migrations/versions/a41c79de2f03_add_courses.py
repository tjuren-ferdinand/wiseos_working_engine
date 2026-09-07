"""add_courses

Revision ID: a41c79de2f03
Revises: e889d11880ea
Create Date: 2026-10-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a41c79de2f03'
down_revision: Union[str, None] = 'e889d11880ea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'courses' not in set(inspector.get_table_names()):
        op.create_table(
            'courses',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('teacher_id', sa.String(length=255), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('code', sa.String(length=100), nullable=False),
            sa.Column('subject', sa.String(length=100), nullable=False),
            sa.Column('level', sa.String(length=100), nullable=True),
            sa.Column('description', sa.Text(), nullable=False),
            sa.Column('grade_thresholds', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_courses_teacher_id', 'courses', ['teacher_id'])
    elif 'ix_courses_teacher_id' not in {i['name'] for i in inspector.get_indexes('courses')}:
        op.create_index('ix_courses_teacher_id', 'courses', ['teacher_id'])


def downgrade() -> None:
    with op.batch_alter_table('courses', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_courses_teacher_id'))
    op.drop_table('courses')
