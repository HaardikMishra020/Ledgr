"""group status + invite created_by

Revision ID: kkk011
Revises: jjj010
Create Date: 2026-02-14 10:30:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "kkk011"
down_revision: Union[str, None] = "jjj010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "groups",
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
    )
    op.create_index("ix_groups_status", "groups", ["status"])

    op.add_column(
        "invites",
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_invites_created_by", "invites", "users", ["created_by"], ["id"]
    )

    op.execute("GRANT UPDATE (status) ON groups TO ledgr_app")


def downgrade() -> None:
    op.drop_constraint("fk_invites_created_by", "invites", type_="foreignkey")
    op.drop_column("invites", "created_by")
    op.drop_index("ix_groups_status", table_name="groups")
    op.drop_column("groups", "status")
