"""Fee component frequency/due day; payment methods; discount rules."""
from alembic import op
import sqlalchemy as sa

revision = "012_fee_finance_extras"
down_revision = "011_role_display_scoped"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fee_components", sa.Column("frequency", sa.String(length=32), nullable=True))
    op.add_column("fee_components", sa.Column("due_day", sa.String(length=32), nullable=True))

    op.create_table(
        "payment_methods",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("method_type", sa.String(length=32), nullable=False, server_default="cash"),
        sa.Column("provider", sa.String(length=120), nullable=True),
        sa.Column("fee_note", sa.String(length=255), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "fee_discount_rules",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("discount_percent", sa.Float(), nullable=False, server_default="0"),
        sa.Column("criteria_type", sa.String(length=40), nullable=False, server_default="custom"),
        sa.Column("criteria_label", sa.String(length=120), nullable=True),
        sa.Column("auto_apply", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("student_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("fee_discount_rules")
    op.drop_table("payment_methods")
    op.drop_column("fee_components", "due_day")
    op.drop_column("fee_components", "frequency")
