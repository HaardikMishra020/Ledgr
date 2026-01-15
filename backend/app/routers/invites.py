import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.group_member import GroupMember
from app.models.invite import Invite
from app.models.user import User
from app.schemas.invites import InviteCreate, InviteResponse

router = APIRouter(prefix="/invites", tags=["invites"])


@router.post("", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
async def create_invite(
    body: InviteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member = await db.scalar(
        select(GroupMember).where(
            GroupMember.group_id == body.group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not a member")

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    invite = Invite(
        group_id=body.group_id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    return InviteResponse(
        id=invite.id,
        group_id=invite.group_id,
        token=token,
        expires_at=invite.expires_at,
    )


@router.post("/{token}/accept", status_code=status.HTTP_200_OK)
async def accept_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    invite = await db.scalar(select(Invite).where(Invite.token_hash == token_hash))

    if not invite or invite.accepted_at or invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="invite not found or expired")

    existing = await db.scalar(
        select(GroupMember).where(
            GroupMember.group_id == invite.group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="already a member")

    member = GroupMember(group_id=invite.group_id, user_id=current_user.id, role="member")
    db.add(member)
    invite.accepted_at = datetime.now(timezone.utc)
    await db.commit()

    return {"message": "joined group"}
