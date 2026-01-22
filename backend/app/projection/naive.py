"""
Naive balance projection: full event replay on every request.

Intentionally unoptimized — O(n) in event count with no caching.
commit 21 replaces this with snapshot + delta replay.
"""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event


async def compute_balances(
    group_id: uuid.UUID, db: AsyncSession
) -> dict[str, dict[str, int]]:
    events = (
        await db.execute(
            select(Event)
            .where(Event.group_id == group_id)
            .order_by(Event.created_at.asc())
        )
    ).scalars().all()

    # Replay events into current expense state (last write wins per expense_id)
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

    # Project into net balances:
    #   positive  = others owe you
    #   negative  = you owe others
    balances: dict[str, dict[str, int]] = {}

    def add(user_id: str, currency: str, amount: int) -> None:
        balances.setdefault(user_id, {}).setdefault(currency, 0)
        balances[user_id][currency] += amount

    for expense in expenses.values():
        currency = expense["currency"]
        amount = int(expense["amount"])
        # Payer fronted the full amount
        add(expense["paid_by"], currency, amount)
        # Each member owes their share (including the payer's own share)
        for split in expense["split"]:
            add(split["user_id"], currency, -int(split["share"]))

    for payment in payments:
        currency = payment["currency"]
        amount = int(payment["amount"])
        # Sender reduces their debt → balance improves
        add(payment["from"], currency, amount)
        # Receiver is owed less → balance decreases
        add(payment["to"], currency, -amount)

    return balances
