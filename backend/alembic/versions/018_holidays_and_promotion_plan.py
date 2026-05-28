"""Holidays and promotion plan settings.

Revision ID: 018_holidays_and_promotion_plan
Revises: 017_k12_timetable_settings
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "018_holidays_and_promotion_plan"
down_revision = "017_k12_timetable_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("education_settings", sa.Column("holidays_json", sa.Text(), nullable=True))
    op.add_column("education_settings", sa.Column("promotion_plan_json", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("education_settings", "promotion_plan_json")
    op.drop_column("education_settings", "holidays_json")

