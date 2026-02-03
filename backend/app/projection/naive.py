"""
Naive balance projection: full event replay on every request.

Intentionally unoptimized — O(n) in event count with no caching.
commit 21 replaces this with snapshot + delta replay.
"""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event


async def compute_state(
    group_id: uuid.UUID, db: AsyncSession
) -> dict:
    """
    Full replay returning both projected balances AND current expense state.
    The snapshot writer stores both so delta replay can correctly handle
    expense_edited and expense_deleted events.
    """
    events = (
        await db.execute(
            select(Event)
            .where(Event.group_id == group_id)
            .order_by(Event.created_at.asc())
        )
    ).scalars().all()

    expenses: dict[str, dict] = {}
    payments: list[dict] = []

    for event in events:
        p = event.payload
        if event.event_type == "expense_added":
            expenses[p["expense_id"]] = p
        elif event.event_type == "expense_edited":
            expenses[p["expense_id"]] = p
        elif event.event_type == "expense_deleted":
            expenses.pop(p["expense_id"], None)
        elif event.event_type == "payment_made":
            payments.append(p)

    balances: dict[str, dict[str, int]] = {}

    def add(user_id: str, currency: str, amount: int) -> None:
        balances.setdefault(user_id, {}).setdefault(currency, 0)
        balances[user_id][currency] += amount

    for expense in expenses.values():
        currency = expense["currency"]
        amount = int(expense["amount"])
        add(expense["paid_by"], currency, amount)
        for split in expense["split"]:
            add(split["user_id"], currency, -int(split["share"]))

    for payment in payments:
        currency = payment["currency"]
        amount = int(payment["amount"])
        add(payment["from"], currency, amount)
        add(payment["to"], currency, -amount)

    return {"balances": balances, "expenses": expenses}


async def compute_balances(
    group_id: uuid.UUID, db: AsyncSession
) -> dict[str, dict[str, int]]:
    return (await compute_state(group_id, db))["balances"]
