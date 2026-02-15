import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.events.store import append_event
from app.fx.rates import get_rate
from app.models.event import Event
from app.models.group import Group
from app.models.group_member import GroupMember
from app.models.user import User
from app.schemas.events import EventResponse
from app.schemas.expenses import AddExpenseRequest, EditExpenseRequest, RecordPaymentRequest

router = APIRouter(prefix="/groups", tags=["expenses"])


def _equal_split(amount: int, members: list) -> list[dict]:
    n = len(members)
    base = amount // n
    remainder = amount % n
    return [
        {"user_id": str(m.user_id), "share": str(base + (remainder if i == 0 else 0))}
        for i, m in enumerate(members)
    ]


async def _require_member(group_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> None:
    member = await db.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not a member of this group")


def _parse_idempotency_key(raw: Optional[str]) -> Optional[uuid.UUID]:
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except ValueError:
        raise HTTPException(status_code=400, detail="Idempotency-Key must be a valid UUID")


async def _build_expense_payload(
    body: AddExpenseRequest | EditExpenseRequest,
    expense_id: str,
    members: list,
    paid_by: uuid.UUID,
    group: Group,
    db: AsyncSession,
) -> dict:
    if body.split is not None:
        total_shares = sum(s.share for s in body.split)
        if total_shares != body.amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"split shares sum to {total_shares} but expense amount is {body.amount}",
            )
        split = [{"user_id": str(s.user_id), "share": str(s.share)} for s in body.split]
    else:
        split = _equal_split(body.amount, members)

    fx_to_default = await get_rate(body.currency, group.default_currency, db)
    occurred = (body.occurred_at or datetime.now(timezone.utc)).isoformat()
    return {
        "expense_id": expense_id,
        "amount": str(body.amount),
        "currency": body.currency,
        "fx_to_default": str(fx_to_default),
        "paid_by": str(paid_by),
        "split": split,
        "description": body.description,
        "occurred_at": occurred,
    }


@router.post("/{group_id}/expenses", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def add_expense(
    group_id: uuid.UUID,
    body: AddExpenseRequest,
    idempotency_key_header: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_member(group_id, current_user.id, db)

    group = await db.scalar(select(Group).where(Group.id == group_id))
    if group.status == "archived":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="group is archived")

    members = (
        await db.execute(select(GroupMember).where(GroupMember.group_id == group_id))
    ).scalars().all()

    paid_by = body.paid_by or current_user.id
    payload = await _build_expense_payload(body, str(uuid.uuid4()), members, paid_by, group, db)

    idem_key = _parse_idempotency_key(idempotency_key_header)
    event = await append_event(group_id, "expense_added", payload, current_user.id, db, idem_key)
    await db.commit()
    await db.refresh(event)
    return event


@router.put("/{group_id}/expenses/{expense_id}", response_model=EventResponse)
async def edit_expense(
    group_id: uuid.UUID,
    expense_id: str,
    body: EditExpenseRequest,
    idempotency_key_header: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_member(group_id, current_user.id, db)

    group = await db.scalar(select(Group).where(Group.id == group_id))
    if group.status == "archived":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="group is archived")

    members = (
        await db.execute(select(GroupMember).where(GroupMember.group_id == group_id))
    ).scalars().all()

    paid_by = body.paid_by or current_user.id
    payload = await _build_expense_payload(body, expense_id, members, paid_by, group, db)

    idem_key = _parse_idempotency_key(idempotency_key_header)
    event = await append_event(group_id, "expense_edited", payload, current_user.id, db, idem_key)
    await db.commit()
    await db.refresh(event)
    return event


@router.delete("/{group_id}/expenses/{expense_id}", response_model=EventResponse)
async def delete_expense(
    group_id: uuid.UUID,
    expense_id: str,
    idempotency_key_header: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_member(group_id, current_user.id, db)

    idem_key = _parse_idempotency_key(idempotency_key_header)
    payload = {"expense_id": expense_id}
    event = await append_event(group_id, "expense_deleted", payload, current_user.id, db, idem_key)
    await db.commit()
    await db.refresh(event)
    return event


# ── Two-step payment flow ──────────────────────────────────────────────────

@router.post("/{group_id}/payments/initiate", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def initiate_payment(
    group_id: uuid.UUID,
    body: RecordPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Payer initiates. Balance does not change yet — receiver must confirm."""
    await _require_member(group_id, current_user.id, db)

    group = await db.scalar(select(Group).where(Group.id == group_id))
    fx_to_default = await get_rate(body.currency, group.default_currency, db)

    payload = {
        "payment_id": str(uuid.uuid4()),
        "from": str(current_user.id),
        "to": str(body.to_user_id),
        "amount": str(body.amount),
        "currency": body.currency,
        "fx_to_default": str(fx_to_default),
    }

    event = await append_event(group_id, "payment_initiated", payload, current_user.id, db)
    await db.commit()
    await db.refresh(event)
    return event


@router.post("/{group_id}/payments/{payment_id}/confirm", response_model=EventResponse)
async def confirm_payment(
    group_id: uuid.UUID,
    payment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Receiver confirms receipt. Balance adjusts on this event."""
    await _require_member(group_id, current_user.id, db)

    # Find the original payment_initiated event
    initiated = await db.scalar(
        select(Event).where(
            Event.group_id == group_id,
            Event.event_type == "payment_initiated",
            Event.payload["payment_id"].as_string() == payment_id,
        )
    )
    if not initiated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="payment not found")

    if initiated.payload["to"] != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only the receiver can confirm")

    # Check not already confirmed
    already = await db.scalar(
        select(Event).where(
            Event.group_id == group_id,
            Event.event_type == "payment_confirmed",
            Event.payload["payment_id"].as_string() == payment_id,
        )
    )
    if already:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="payment already confirmed")

    payload = {**initiated.payload}  # same fields, new event type
    event = await append_event(group_id, "payment_confirmed", payload, current_user.id, db)
    await db.commit()
    await db.refresh(event)
    return event


@router.get("/{group_id}/pending-payments")
async def get_pending_payments(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """All payment_initiated events without a matching payment_confirmed."""
    await _require_member(group_id, current_user.id, db)

    events = (
        await db.execute(
            select(Event)
            .where(
                Event.group_id == group_id,
                Event.event_type.in_(["payment_initiated", "payment_confirmed"]),
            )
            .order_by(Event.created_at)
        )
    ).scalars().all()

    initiated: dict[str, dict] = {}
    confirmed_ids: set[str] = set()

    for ev in events:
        pid = ev.payload.get("payment_id", "")
        if ev.event_type == "payment_initiated":
            initiated[pid] = {**ev.payload, "created_at": ev.created_at.isoformat()}
        elif ev.event_type == "payment_confirmed":
            confirmed_ids.add(pid)

    return [p for pid, p in initiated.items() if pid not in confirmed_ids]


# ── Legacy direct payment (kept for backward compat) ──────────────────────

@router.post("/{group_id}/payments", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def record_payment(
    group_id: uuid.UUID,
    body: RecordPaymentRequest,
    idempotency_key_header: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_member(group_id, current_user.id, db)

    group = await db.scalar(select(Group).where(Group.id == group_id))
    fx_to_default = await get_rate(body.currency, group.default_currency, db)

    payload = {
        "from": str(current_user.id),
        "to": str(body.to_user_id),
        "amount": str(body.amount),
        "currency": body.currency,
        "fx_to_default": str(fx_to_default),
    }

    idem_key = _parse_idempotency_key(idempotency_key_header)
    event = await append_event(group_id, "payment_made", payload, current_user.id, db, idem_key)
    await db.commit()
    await db.refresh(event)
    return event


@router.get("/{group_id}/activity", response_model=list[EventResponse])
async def activity_feed(
    group_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_member(group_id, current_user.id, db)

    result = await db.execute(
        select(Event)
        .where(Event.group_id == group_id)
        .order_by(Event.created_at.asc())
        .limit(limit)
    )
    return result.scalars().all()
