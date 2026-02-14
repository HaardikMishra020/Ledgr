"""
Naive balance projection: full event replay on every request.
commit 21 replaces the balance endpoint with snapshot + delta replay.
"""
import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event


async def compute_state(
    group_id: uuid.UUID, db: AsyncSession, default_currency: str = "USD"
) -> dict:
    events = (
        await db.execute(
            select(Event)
            .where(Event.group_id == group_id)
            .order_by(Event.created_at.asc())
        )
    ).scalars().all()

    expenses: dict[str, dict] = {}
    confirmed_payments: list[dict] = []
    # Track initiated-but-unconfirmed payments so delta replay can reverse if needed
    pending_payments: dict[str, dict] = {}

    for event in events:
        p = event.payload
        if event.event_type == "expense_added":
            expenses[p["expense_id"]] = p
        elif event.event_type == "expense_edited":
            expenses[p["expense_id"]] = p
        elif event.event_type == "expense_deleted":
            expenses.pop(p["expense_id"], None)
        elif event.event_type == "payment_made":
            # Legacy direct payment — immediately affects balance
            confirmed_payments.append(p)
        elif event.event_type == "payment_initiated":
            pending_payments[p["payment_id"]] = p
        elif event.event_type == "payment_confirmed":
            payment = pending_payments.pop(p["payment_id"], None)
            if payment:
                confirmed_payments.append(payment)

    balances: dict[str, dict[str, int]] = {}

    def add(user_id: str, amount: int) -> None:
        balances.setdefault(user_id, {}).setdefault(default_currency, 0)
        balances[user_id][default_currency] += amount

    def to_default(amount_minor: int, fx: str) -> int:
        return int(amount_minor * Decimal(fx))

    for expense in expenses.values():
        fx = expense.get("fx_to_default", "1")
        amount_default = to_default(int(expense["amount"]), fx)
        add(expense["paid_by"], amount_default)
        for split in expense["split"]:
            add(split["user_id"], -to_default(int(split["share"]), fx))

    for payment in confirmed_payments:
        fx = payment.get("fx_to_default", "1")
        amount_default = to_default(int(payment["amount"]), fx)
        add(payment["from"], amount_default)
        add(payment["to"], -amount_default)

    return {"balances": balances, "expenses": expenses}


async def compute_balances(
    group_id: uuid.UUID, db: AsyncSession, default_currency: str = "USD"
) -> dict[str, dict[str, int]]:
    return (await compute_state(group_id, db, default_currency))["balances"]
