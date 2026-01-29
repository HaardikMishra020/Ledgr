"""snapshots table

Revision ID: hhh008
Revises: ggg007
Create Date: 2026-01-29 10:40:00

Snapshots are mutable derived state — safe to truncate and rebuild from events.
One row per group: the latest balance snapshot up to `up_to_sequence`.

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "hhh008"
down_revision: Union[str, None] = "ggg007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "snapshots",
        sa.Column(
            "group_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("up_to_sequence", sa.BigInteger(), nullable=False),
        sa.Column("state", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("group_id"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
    )

    # Grant ledgr_app full access (snapshots ARE mutable — that's intentional)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON snapshots TO ledgr_app")


def downgrade() -> None:
    op.drop_table("snapshots")
