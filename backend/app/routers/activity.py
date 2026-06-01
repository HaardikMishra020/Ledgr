import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.event import Event
from app.models.group import Group
from app.models.group_member import GroupMember
from app.models.user import User

router = APIRouter(prefix="/activity", tags=["activity"])


class RichEventResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    group_name: str
    event_type: str
    event_version: int
    payload: dict
    actor_user_id: uuid.UUID
    actor_display_name: str
    created_at: datetime

    model_config = {"from_attributes": False}


@router.get("", response_model=list[RichEventResponse])
async def global_activity(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cross-group activity feed for the current user, newest first, actor names resolved."""
    group_ids = list(
        (
            await db.execute(
                select(GroupMember.group_id).where(GroupMember.user_id == current_user.id)
            )
        ).scalars().all()
    )

    if not group_ids:
        return []

    rows = (
        await db.execute(
            select(Event, User, Group)
            .join(User, User.id == Event.actor_user_id)
            .join(Group, Group.id == Event.group_id)
            .where(Event.group_id.in_(group_ids))
            .order_by(Event.created_at.desc())
            .limit(limit)
        )
    ).all()

    return [
        RichEventResponse(
            id=ev.id,
            group_id=ev.group_id,
            group_name=grp.name,
            event_type=ev.event_type,
            event_version=ev.event_version,
            payload=ev.payload,
            actor_user_id=ev.actor_user_id,
            actor_display_name=actor.display_name,
            created_at=ev.created_at,
        )
        for ev, actor, grp in rows
    ]
