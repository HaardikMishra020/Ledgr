"""users default_currency

Revision ID: 015
Revises: 014
Create Date: 2026-06-01
"""
from alembic import op
import sqlalchemy as sa

revision = "ooo015"
down_revision = "nnn014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "default_currency",
            sa.String(length=8),
            nullable=False,
            server_default="USD",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "default_currency")
