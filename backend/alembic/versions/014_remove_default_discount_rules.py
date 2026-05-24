"""Remove auto-seeded discount rules (user-created only going forward)."""
from alembic import op

revision = "014_drop_seed_discounts"
down_revision = "013_school_currency"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM fee_discount_rules
        WHERE criteria_type IN ('sibling_2nd', 'sibling_3rd', 'staff_child')
        """
    )


def downgrade() -> None:
    pass
