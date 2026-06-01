"""add icon to groups

Revision ID: mmm013
Revises: lll012
Create Date: 2026-05-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "mmm013"
down_revision: Union[str, None] = "lll012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("groups", sa.Column("icon", sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column("groups", "icon")
