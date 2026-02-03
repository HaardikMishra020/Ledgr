"""
Event store: the single path for appending to the events table.

Uses optimistic concurrency control (OCC) via the unique constraint on
(group_id, sequence_number). If two writers race, one gets an IntegrityError
and retries with the next sequence number.

Supports idempotency keys: duplicate submissions with the same key return the
existing event without creating a new one.

Auto-triggers a snapshot rebuild every _SNAPSHOT_INTERVAL events so the delta
replay path (commit 21) never reads more than _SNAPSHOT_INTERVAL events.
"""
import uuid
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event

_MAX_OCC_RETRIES = 5
_SNAPSHOT_INTERVAL = 50


async def append_event(
    group_id: uuid.UUID,
    event_type: str,
    payload: dict,
    actor_user_id: uuid.UUID,
    db: AsyncSession,
    idempotency_key: Optional[uuid.UUID] = None,
) -> Event:
    if idempotency_key is not None:
        existing = await db.scalar(
            select(Event).where(Event.idempotency_key == idempotency_key)
        )
        if existing:
            return existing

    for attempt in range(_MAX_OCC_RETRIES):
        try:
            next_seq = await _next_sequence(group_id, db)
            event = Event(
                group_id=group_id,
                sequence_number=next_seq,
                event_type=event_type,
                event_version=1,
                payload=payload,
                actor_user_id=actor_user_id,
                idempotency_key=idempotency_key,
            )
            db.add(event)
            await db.flush()

            if next_seq % _SNAPSHOT_INTERVAL == 0:
                from app.snapshots.writer import write_snapshot
                await write_snapshot(group_id, db)

            return event
        except IntegrityError as exc:
            await db.rollback()
            if "uq_events_group_seq" not in str(exc) or attempt == _MAX_OCC_RETRIES - 1:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="write conflict, please retry",
                ) from exc

    raise RuntimeError("unreachable")


async def _next_sequence(group_id: uuid.UUID, db: AsyncSession) -> int:
    current_max = await db.scalar(
        select(func.max(Event.sequence_number)).where(Event.group_id == group_id)
    )
    return (current_max or 0) + 1
