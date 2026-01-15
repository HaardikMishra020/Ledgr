import uuid
from datetime import datetime

from pydantic import BaseModel


class InviteCreate(BaseModel):
    group_id: uuid.UUID


class InviteResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    token: str
    expires_at: datetime
