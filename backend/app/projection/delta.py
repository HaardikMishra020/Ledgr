"""
Snapshot + delta replay projection. O(1) in total event history.
"""
import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.snapshot import Snapshot
from app.projection.naive import compute_balances as full_replay


async def compute_balances(
    group_id: uuid.UUID, db: AsyncSession, default_currency: str = "USD"
) -> dict[str, dict[str, int]]:
    snapshot = await db.scalar(
        select(Snapshot).where(Snapshot.group_id == group_id)
    )

    if snapshot is None:
        return await full_replay(group_id, db, default_currency)

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

    def add(uid: str, amt: int) -> None:
        balances.setdefault(uid, {}).setdefault(default_currency, 0)
        balances[uid][default_currency] += amt

    def to_default(amount_minor: int, fx: str) -> int:
        return int(amount_minor * Decimal(fx))

    def apply_expense(expense: dict, sign: int) -> None:
        fx = expense.get("fx_to_default", "1")
        amount_default = to_default(int(expense["amount"]), fx) * sign
        add(expense["paid_by"], amount_default)
        for s in expense["split"]:
            add(s["user_id"], -to_default(int(s["share"]), fx) * sign)

    def apply_payment(payment: dict) -> None:
        fx = payment.get("fx_to_default", "1")
        amt = to_default(int(payment["amount"]), fx)
        add(payment["from"], amt)
        add(payment["to"], -amt)

    # Track pending payments in the delta window
    pending: dict[str, dict] = {}

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
            apply_payment(p)
        elif event.event_type == "payment_initiated":
            pending[p["payment_id"]] = p
        elif event.event_type == "payment_confirmed":
            payment = pending.pop(p["payment_id"], None)
            if payment:
                apply_payment(payment)
            else:
                # Confirmed event whose initiated event is before the snapshot
                # The snapshot balances already exclude pending payments,
                # so we apply it directly from the confirmed payload
                apply_payment(p)

    return balances
