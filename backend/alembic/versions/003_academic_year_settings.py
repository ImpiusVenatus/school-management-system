"""Academic year status and school year-cycle settings."""
from alembic import op
import sqlalchemy as sa

revision = "003_academic_year_settings"
down_revision = "002_rbac_k12_invoices"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "education_settings",
        sa.Column("academic_year_start_month", sa.Integer(), nullable=False, server_default="4"),
    )
    op.add_column(
        "academic_years",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="closed"),
    )


def downgrade() -> None:
    op.drop_column("academic_years", "status")
    op.drop_column("education_settings", "academic_year_start_month")
