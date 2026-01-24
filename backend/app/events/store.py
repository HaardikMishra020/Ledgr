"""
Event store: the single path for appending to the events table.

Uses optimistic concurrency control (OCC) via the unique constraint on
(group_id, sequence_number). If two writers race, one gets an IntegrityError
and retries with the next sequence number.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event

_MAX_OCC_RETRIES = 5


async def append_event(
    group_id: uuid.UUID,
    event_type: str,
    payload: dict,
    actor_user_id: uuid.UUID,
    db: AsyncSession,
) -> Event:
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
            )
            db.add(event)
            await db.flush()
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
