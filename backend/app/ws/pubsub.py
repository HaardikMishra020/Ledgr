"""
Redis pub/sub publish helper.

Each API instance subscribes to the group channel for its connected WebSocket
clients. Publishing here reaches all instances, not just the one that wrote
the event. Replaces the in-memory registry from commit 25.
"""
import json

from app.db.redis import get_redis


async def publish(group_id: str, message: dict) -> None:
    redis = await get_redis()
    await redis.publish(f"group:{group_id}", json.dumps(message))
