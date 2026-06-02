import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class GroupCreate(BaseModel):
    name: str
    default_currency: str = "INR"
    icon: Optional[str] = None


class GroupResponse(BaseModel):
    id: uuid.UUID
    name: str
    icon: Optional[str] = None
    default_currency: str
    created_by: uuid.UUID
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
