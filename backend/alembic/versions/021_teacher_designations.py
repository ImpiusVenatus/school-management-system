"""Teacher designations and instructor designation_id.

Revision ID: 021_teacher_designations
Revises: 020_instructor_department_id
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa


revision = "021_teacher_designations"
down_revision = "020_instructor_department_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "teacher_designations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_teacher_designations_name", "teacher_designations", ["name"], unique=True)

    op.add_column(
        "instructors",
        sa.Column("designation_id", sa.String(), sa.ForeignKey("teacher_designations.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column("instructors", sa.Column("designation", sa.String(), nullable=True))
    op.create_index("ix_instructors_designation_id", "instructors", ["designation_id"])


def downgrade() -> None:
    op.drop_index("ix_instructors_designation_id", table_name="instructors")
    op.drop_column("instructors", "designation")
    op.drop_column("instructors", "designation_id")
    op.drop_index("ix_teacher_designations_name", table_name="teacher_designations")
    op.drop_table("teacher_designations")
