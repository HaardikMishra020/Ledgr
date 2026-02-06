"""event_outbox table for reliable WebSocket publish

Revision ID: iii009
Revises: hhh008
Create Date: 2026-02-06 09:45:00

The outbox row is written in the same transaction as the event. A background
worker drains pending rows to Redis, ensuring subscribers never miss an event
even if the API process crashes between the DB write and the Redis publish.

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "iii009"
down_revision: Union[str, None] = "hhh008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "event_outbox",
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("published_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("event_id"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
    )
    # Partial index: only index pending (unpublished) rows
    op.execute(
        "CREATE INDEX ix_event_outbox_pending ON event_outbox (published_at) "
        "WHERE published_at IS NULL"
    )
    op.execute("GRANT SELECT, INSERT, UPDATE ON event_outbox TO ledgr_app")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_event_outbox_pending")
    op.drop_table("event_outbox")
