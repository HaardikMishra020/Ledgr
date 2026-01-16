"""events table (append-only, no OCC yet)

Revision ID: ddd004
Revises: ccc003
Create Date: 2026-01-16 11:20:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "ddd004"
down_revision: Union[str, None] = "ccc003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column(
            "event_version",
            sa.SmallInteger(),
            nullable=False,
            server_default="1",
        ),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
    )
    op.create_index(
        "ix_events_group_created",
        "events",
        ["group_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_events_group_created", table_name="events")
    op.drop_table("events")
