"""K12 enrollment stream (Science/Commerce/Arts).

Revision ID: 023_k12_enroll_stream
Revises: 022_instructor_emp_id_uq
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa


revision = "023_k12_enroll_stream"
down_revision = "022_instructor_emp_id_uq"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("k12_student_enrollments", sa.Column("stream", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("k12_student_enrollments", "stream")

