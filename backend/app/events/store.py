"""
Event store: the single path for appending to the events table.

Each append writes event + outbox row in one flush (same DB transaction).
The background worker in app/ws/worker.py drains pending outbox rows to Redis,
ensuring WebSocket subscribers never miss an event even on process crash.
"""
import uuid
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.outbox import EventOutbox

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
            db.add(EventOutbox(event_id=event.id))
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
