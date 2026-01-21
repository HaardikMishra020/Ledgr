import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AddExpenseRequest(BaseModel):
    description: str
    amount: int  # integer minor units (e.g. 2400 = $24.00)
    currency: str = "USD"
    paid_by: Optional[uuid.UUID] = None
    occurred_at: Optional[datetime] = None


class EditExpenseRequest(BaseModel):
    description: str
    amount: int
    currency: str = "USD"
    paid_by: Optional[uuid.UUID] = None
    occurred_at: Optional[datetime] = None


class RecordPaymentRequest(BaseModel):
    to_user_id: uuid.UUID
    amount: int  # integer minor units
    currency: str = "USD"
