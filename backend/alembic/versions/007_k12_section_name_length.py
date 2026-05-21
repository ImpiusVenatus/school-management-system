"""Widen k12_sections.name for longer section labels."""
from alembic import op
import sqlalchemy as sa

revision = "007_k12_section_name_length"
down_revision = "006_ay_cycle_default_january"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "k12_sections",
        "name",
        existing_type=sa.String(length=10),
        type_=sa.String(length=50),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "k12_sections",
        "name",
        existing_type=sa.String(length=50),
        type_=sa.String(length=10),
        existing_nullable=False,
    )
