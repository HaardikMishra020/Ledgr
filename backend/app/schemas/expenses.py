import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SplitEntry(BaseModel):
    user_id: uuid.UUID
    share: int  # minor units


class AddExpenseRequest(BaseModel):
    description: str
    amount: int  # integer minor units (e.g. 2400 = $24.00)
    currency: str = "USD"
    paid_by: Optional[uuid.UUID] = None
    occurred_at: Optional[datetime] = None
    split: Optional[list[SplitEntry]] = None  # None = equal split computed server-side


class EditExpenseRequest(BaseModel):
    description: str
    amount: int
    currency: str = "USD"
    paid_by: Optional[uuid.UUID] = None
    occurred_at: Optional[datetime] = None
    split: Optional[list[SplitEntry]] = None


class RecordPaymentRequest(BaseModel):
    to_user_id: uuid.UUID
    amount: int  # integer minor units
    currency: str = "USD"
