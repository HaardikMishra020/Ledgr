import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class InviteCreate(BaseModel):
    group_id: uuid.UUID


class InviteResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    token: str
    expires_at: datetime


class MemberPreview(BaseModel):
    display_name: str
    avatar_url: Optional[str] = None


class InviteInfoResponse(BaseModel):
    group_id: uuid.UUID
    group_name: str
    group_icon: Optional[str] = None
    invited_by: str
    expires_at: datetime
    already_accepted: bool
    member_count: int = 0
    member_preview: list[MemberPreview] = []
