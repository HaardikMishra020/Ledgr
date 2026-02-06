"""
Outbox worker: drains pending event_outbox rows to Redis pub/sub.

Runs as a background task started at app startup. Polls every second for
unprocessed outbox rows and publishes each event's group channel on Redis,
then marks the row as published.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.redis import get_redis
from app.db.session import AsyncSessionLocal
from app.models.event import Event
from app.models.outbox import EventOutbox

logger = logging.getLogger(__name__)


async def drain_outbox() -> None:
    async with AsyncSessionLocal() as db:
        pending = (
            await db.execute(
                select(EventOutbox)
                .where(EventOutbox.published_at.is_(None))
                .limit(100)
            )
        ).scalars().all()

        if not pending:
            return

        redis = await get_redis()
        for row in pending:
            event = await db.scalar(select(Event).where(Event.id == row.event_id))
            if event is None:
                continue
            message = json.dumps(
                {"type": event.event_type, "event_id": str(event.id)}
            )
            await redis.publish(f"group:{event.group_id}", message)
            row.published_at = datetime.now(timezone.utc)

        await db.commit()


async def run_outbox_worker() -> None:
    logger.info("outbox worker started")
    while True:
        try:
            await drain_outbox()
        except Exception:
            logger.exception("outbox drain failed")
        await asyncio.sleep(1)
