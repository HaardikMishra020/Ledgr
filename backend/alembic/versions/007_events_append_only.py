"""enforce append-only on events at the database role level

Revision ID: ggg007
Revises: fff006
Create Date: 2026-01-26 11:15:00

Creates a restricted `ledgr_app` role that has SELECT + INSERT on all tables
but no UPDATE or DELETE on `events`. The API service should connect using this
role (set DATABASE_URL accordingly). The superuser/migration role (`ledgr`)
retains full access for migrations.

"""
from typing import Sequence, Union

from alembic import op

revision: str = "ggg007"
down_revision: Union[str, None] = "fff006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the application role
    op.execute("CREATE ROLE ledgr_app WITH LOGIN PASSWORD 'ledgr_app'")

    # Grant read/write access to all current and future tables
    op.execute("GRANT USAGE ON SCHEMA public TO ledgr_app")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ledgr_app")
    op.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ledgr_app")
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ledgr_app"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "GRANT USAGE, SELECT ON SEQUENCES TO ledgr_app"
    )

    # events is append-only: strip mutation privileges
    op.execute("REVOKE UPDATE, DELETE ON events FROM ledgr_app")


def downgrade() -> None:
    op.execute("REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ledgr_app")
    op.execute("REVOKE USAGE ON SCHEMA public FROM ledgr_app")
    op.execute("DROP ROLE IF EXISTS ledgr_app")
