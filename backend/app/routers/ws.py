import asyncio
import uuid

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.redis import get_redis
from app.db.session import get_db
from app.models.group_member import GroupMember

router = APIRouter(tags=["websocket"])


@router.websocket("/groups/{group_id}/ws")
async def websocket_endpoint(
    group_id: uuid.UUID,
    ws: WebSocket,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_id = decode_access_token(token)
    except JWTError:
        await ws.close(code=4001)
        return

    member = await db.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )
    if not member:
        await ws.close(code=4003)
        return

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
