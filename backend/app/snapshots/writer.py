"""
Snapshot writer: persist full balance + expense state at the current sequence.

Stores both `balances` and `expenses` so delta replay can correctly reverse
expense_edited and expense_deleted events without needing to re-read old events.
"""
import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.snapshot import Snapshot
from app.projection.naive import compute_state


async def write_snapshot(group_id: uuid.UUID, db: AsyncSession) -> None:
    state = await compute_state(group_id, db)

    max_seq: int = await db.scalar(
        select(func.max(Event.sequence_number)).where(Event.group_id == group_id)
    ) or 0

    stmt = (
        pg_insert(Snapshot)
        .values(group_id=group_id, up_to_sequence=max_seq, state=state)
        .on_conflict_do_update(
            index_elements=["group_id"],
            set_={"up_to_sequence": max_seq, "state": state},
        )
    )
    await db.execute(stmt)
