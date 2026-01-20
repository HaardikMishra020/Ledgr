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
