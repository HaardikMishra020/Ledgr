"""
Snapshot writer: compute current balance state and persist it.

The snapshot stores the projected balances at the highest event sequence_number
seen so far. commit 21 will use this to skip expensive full replays.
"""
import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.snapshot import Snapshot
from app.projection.naive import compute_balances


async def write_snapshot(group_id: uuid.UUID, db: AsyncSession) -> None:
    balances = await compute_balances(group_id, db)

    max_seq: int = await db.scalar(
        select(func.max(Event.sequence_number)).where(Event.group_id == group_id)
    ) or 0

    state = {"balances": balances}

    stmt = (
        pg_insert(Snapshot)
        .values(group_id=group_id, up_to_sequence=max_seq, state=state)
        .on_conflict_do_update(
            index_elements=["group_id"],
            set_={"up_to_sequence": max_seq, "state": state},
        )
    )
    await db.execute(stmt)
