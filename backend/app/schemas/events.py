import uuid
from datetime import datetime

from pydantic import BaseModel


class EventResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    event_type: str
    event_version: int
    payload: dict
    actor_user_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
