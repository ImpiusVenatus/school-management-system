"""Club roles and member role_id.

Revision ID: 019_club_roles_member_role
Revises: 018_holidays_and_promotion_plan
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "019_club_roles_member_role"
down_revision = "018_holidays_and_promotion_plan"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "club_roles",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column("club_id", sa.String(), nullable=False),
        sa.Column("academic_year_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_unique", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["club_id"], ["clubs.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("club_id", "academic_year_id", "name", name="uq_club_roles_club_year_name"),
    )
    op.create_index("ix_club_roles_club_year", "club_roles", ["club_id", "academic_year_id"])

    op.add_column("club_members", sa.Column("role_id", sa.String(), nullable=True))
    op.add_column("club_members", sa.Column("role_name", sa.String(), nullable=True))
    op.create_foreign_key(
        "fk_club_members_role_id",
        "club_members",
        "club_roles",
        ["role_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_club_members_role_id", "club_members", ["role_id"])

    # Backfill: keep current free-text role in role_name for existing rows
    op.execute("UPDATE club_members SET role_name = role WHERE role_name IS NULL")


def downgrade() -> None:
    op.drop_index("ix_club_members_role_id", table_name="club_members")
    op.drop_constraint("fk_club_members_role_id", "club_members", type_="foreignkey")
    op.drop_column("club_members", "role_name")
    op.drop_column("club_members", "role_id")

    op.drop_index("ix_club_roles_club_year", table_name="club_roles")
    op.drop_table("club_roles")
