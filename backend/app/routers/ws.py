import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.ws import registry

router = APIRouter(tags=["websocket"])


@router.websocket("/groups/{group_id}/ws")
async def websocket_endpoint(group_id: uuid.UUID, ws: WebSocket):
    await ws.accept()
    gid = str(group_id)
    registry.register(gid, ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        registry.unregister(gid, ws)
