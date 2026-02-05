"""
In-memory WebSocket connection registry.

Single-instance only — connections on a different process are invisible.
commit 26 replaces this with Redis pub/sub fanout.
"""
from collections import defaultdict

from fastapi import WebSocket

_connections: dict[str, set[WebSocket]] = defaultdict(set)


def register(group_id: str, ws: WebSocket) -> None:
    _connections[group_id].add(ws)


def unregister(group_id: str, ws: WebSocket) -> None:
    _connections[group_id].discard(ws)


async def broadcast(group_id: str, message: dict) -> None:
    import json

    dead: set[WebSocket] = set()
    for ws in list(_connections.get(group_id, set())):
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            dead.add(ws)
    for ws in dead:
        unregister(group_id, ws)
