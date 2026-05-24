"""Remove sample payment methods seeded on empty table."""
from alembic import op

revision = "015_drop_seed_payments"
down_revision = "014_drop_seed_discounts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM payment_methods
        WHERE name IN (
            'Cash at office',
            'UPI - Razorpay',
            'Card - Razorpay'
        )
        """
    )
    op.execute(
        """
        DELETE FROM fee_discount_rules
        WHERE criteria_type IN ('sibling_2nd', 'sibling_3rd', 'staff_child')
           OR name ILIKE 'Sibling discount%'
           OR name ILIKE 'Staff children%'
        """
    )


def downgrade() -> None:
    pass
