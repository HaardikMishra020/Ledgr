"""add idempotency_key to events

Revision ID: fff006
Revises: eee005
Create Date: 2026-01-25 14:30:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "fff006"
down_revision: Union[str, None] = "eee005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column("idempotency_key", postgresql.UUID(as_uuid=True), nullable=True),
    )
    # Partial unique index — only enforces uniqueness on rows where key is set
    op.execute(
        "CREATE UNIQUE INDEX uq_events_idempotency_key ON events (idempotency_key) "
        "WHERE idempotency_key IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_events_idempotency_key")
    op.drop_column("events", "idempotency_key")
