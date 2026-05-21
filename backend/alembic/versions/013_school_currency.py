"""School currency code on education settings."""
from alembic import op
import sqlalchemy as sa

revision = "013_school_currency"
down_revision = "012_fee_finance_extras"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "education_settings",
        sa.Column("currency_code", sa.String(length=3), nullable=False, server_default="BDT"),
    )


def downgrade() -> None:
    op.drop_column("education_settings", "currency_code")
