import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    avatar_url: Optional[str] = None
    default_currency: str = "USD"
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    display_name: str
    default_currency: Optional[str] = None


class UserSearchResult(BaseModel):
    id: uuid.UUID
    display_name: str
    email: str

    model_config = {"from_attributes": True}


class FriendRequest(BaseModel):
    addressee_id: uuid.UUID


class FriendshipResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    display_name: str
    email: str
    avatar_url: Optional[str] = None
    status: str
    is_requester: bool
    created_at: datetime
