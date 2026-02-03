"""
Snapshot + delta replay projection.

Hot path: load snapshot → replay only events with sequence_number > snapshot.up_to_sequence.
Falls back to full replay when no snapshot exists.
"""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.snapshot import Snapshot
from app.projection.naive import compute_balances as full_replay


async def compute_balances(
    group_id: uuid.UUID, db: AsyncSession
) -> dict[str, dict[str, int]]:
    snapshot = await db.scalar(
        select(Snapshot).where(Snapshot.group_id == group_id)
    )

    if snapshot is None:
        return await full_replay(group_id, db)

    # Restore mutable copies of snapshot state
    balances: dict[str, dict[str, int]] = {
        uid: dict(ccys) for uid, ccys in snapshot.state["balances"].items()
    }
    expenses: dict[str, dict] = dict(snapshot.state.get("expenses", {}))

    delta = (
        await db.execute(
            select(Event)
            .where(
                Event.group_id == group_id,
                Event.sequence_number > snapshot.up_to_sequence,
            )
            .order_by(Event.sequence_number.asc())
        )
    ).scalars().all()

    def add(uid: str, ccy: str, amt: int) -> None:
        balances.setdefault(uid, {}).setdefault(ccy, 0)
        balances[uid][ccy] += amt

    def apply_expense(expense: dict, sign: int) -> None:
        ccy = expense["currency"]
        amount = int(expense["amount"]) * sign
        add(expense["paid_by"], ccy, amount)
        for s in expense["split"]:
            add(s["user_id"], ccy, -int(s["share"]) * sign)

    for event in delta:
        p = event.payload
        if event.event_type == "expense_added":
            expenses[p["expense_id"]] = p
            apply_expense(p, +1)
        elif event.event_type == "expense_edited":
            if p["expense_id"] in expenses:
                apply_expense(expenses[p["expense_id"]], -1)
            expenses[p["expense_id"]] = p
            apply_expense(p, +1)
        elif event.event_type == "expense_deleted":
            if p["expense_id"] in expenses:
                apply_expense(expenses[p["expense_id"]], -1)
                del expenses[p["expense_id"]]
        elif event.event_type == "payment_made":
            amt = int(p["amount"])
            ccy = p["currency"]
            add(p["from"], ccy, amt)
            add(p["to"], ccy, -amt)

    return balances
