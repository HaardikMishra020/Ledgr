"""fx_rates table

Revision ID: jjj010
Revises: iii009
Create Date: 2026-02-07 10:30:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "jjj010"
down_revision: Union[str, None] = "iii009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fx_rates",
        sa.Column("base", sa.String(3), nullable=False),
        sa.Column("quote", sa.String(3), nullable=False),
        sa.Column("rate", sa.Numeric(20, 10), nullable=False),
        sa.Column("as_of", sa.Date(), nullable=False),
        sa.PrimaryKeyConstraint("base", "quote", "as_of"),
    )
    op.create_index("ix_fx_rates_base_quote", "fx_rates", ["base", "quote", "as_of"])
    op.execute("GRANT SELECT, INSERT ON fx_rates TO ledgr_app")


def downgrade() -> None:
    op.drop_index("ix_fx_rates_base_quote", table_name="fx_rates")
    op.drop_table("fx_rates")
