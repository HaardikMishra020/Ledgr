import uuid
from datetime import datetime

from pydantic import BaseModel


class GroupCreate(BaseModel):
    name: str
    default_currency: str = "USD"


class GroupResponse(BaseModel):
    id: uuid.UUID
    name: str
    default_currency: str
    created_by: uuid.UUID
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
