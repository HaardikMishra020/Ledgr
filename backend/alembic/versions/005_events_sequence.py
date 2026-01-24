"""add per-group sequence_number to events

Revision ID: eee005
Revises: ddd004
Create Date: 2026-01-24 09:50:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "eee005"
down_revision: Union[str, None] = "ddd004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("sequence_number", sa.BigInteger(), nullable=True))

    # Backfill: assign monotonic sequence numbers per group ordered by created_at
    op.execute(
        """
        UPDATE events e
        SET sequence_number = sub.rn
        FROM (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY created_at) AS rn
            FROM events
        ) sub
        WHERE e.id = sub.id
        """
    )

    op.alter_column("events", "sequence_number", nullable=False)

    op.create_unique_constraint("uq_events_group_seq", "events", ["group_id", "sequence_number"])
    op.create_index("ix_events_group_seq", "events", ["group_id", "sequence_number"])


def downgrade() -> None:
    op.drop_index("ix_events_group_seq", table_name="events")
    op.drop_constraint("uq_events_group_seq", "events", type_="unique")
    op.drop_column("events", "sequence_number")
