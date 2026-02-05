import asyncio
import json
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.db.redis import get_redis

router = APIRouter(tags=["websocket"])


@router.websocket("/groups/{group_id}/ws")
async def websocket_endpoint(group_id: uuid.UUID, ws: WebSocket):
    await ws.accept()
    channel = f"group:{group_id}"

    redis = await get_redis()
    async with redis.pubsub() as pubsub:
        await pubsub.subscribe(channel)

        forward_task = asyncio.create_task(_forward(pubsub, ws))
        try:
            while True:
                await ws.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            forward_task.cancel()
            await pubsub.unsubscribe(channel)


async def _forward(pubsub, ws: WebSocket) -> None:
    async for message in pubsub.listen():
        if message["type"] == "message":
            try:
                await ws.send_text(message["data"])
            except Exception:
                return
