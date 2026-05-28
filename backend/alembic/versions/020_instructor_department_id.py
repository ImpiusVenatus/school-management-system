"""Link instructors to academic_departments.

Revision ID: 020_instructor_department_id
Revises: 019_club_roles_member_role
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa


revision = "020_instructor_department_id"
down_revision = "019_club_roles_member_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "instructors",
        sa.Column("department_id", sa.String(), sa.ForeignKey("academic_departments.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_instructors_department_id", "instructors", ["department_id"])
    op.execute(
        """
        UPDATE instructors i
        SET department_id = d.id
        FROM academic_departments d
        WHERE i.department IS NOT NULL
          AND trim(i.department) <> ''
          AND lower(trim(i.department)) = lower(trim(d.name))
        """
    )


def downgrade() -> None:
    op.drop_index("ix_instructors_department_id", table_name="instructors")
    op.drop_column("instructors", "department_id")
