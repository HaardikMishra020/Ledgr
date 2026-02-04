from pydantic import BaseModel


class TransactionItem(BaseModel):
    from_user: str
    to_user: str
    amount: int
    currency: str


class SettlementResponse(BaseModel):
    transactions: list[TransactionItem]
