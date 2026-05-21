"""Default academic year cycle to January (month 1)."""
from alembic import op

revision = "006_ay_cycle_default_january"
down_revision = "005_settings_extras"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "education_settings",
        "academic_year_start_month",
        server_default="1",
    )


def downgrade() -> None:
    op.alter_column(
        "education_settings",
        "academic_year_start_month",
        server_default="4",
    )
