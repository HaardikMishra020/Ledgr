import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.events.store import append_event
from app.models.event import Event
from app.models.group_member import GroupMember
from app.models.user import User
from app.schemas.events import EventResponse
from app.schemas.expenses import AddExpenseRequest, EditExpenseRequest, RecordPaymentRequest
from app.ws.pubsub import publish as ws_publish

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


async def _emit(event: Event) -> None:
    await ws_publish(
        str(event.group_id),
        {"type": event.event_type, "event_id": str(event.id)},
    )


@router.post("/{group_id}/expenses", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def add_expense(
    group_id: uuid.UUID,
    body: AddExpenseRequest,
    idempotency_key_header: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_member(group_id, current_user.id, db)

    members = (
        await db.execute(select(GroupMember).where(GroupMember.group_id == group_id))
    ).scalars().all()

    split = _equal_split(body.amount, members)
    paid_by = body.paid_by or current_user.id
    occurred = (body.occurred_at or datetime.now(timezone.utc)).isoformat()

    payload = {
        "expense_id": str(uuid.uuid4()),
        "amount": str(body.amount),
        "currency": body.currency,
        "fx_to_default": "1.0000",
        "paid_by": str(paid_by),
        "split": split,
        "description": body.description,
        "occurred_at": occurred,
    }

    idem_key = _parse_idempotency_key(idempotency_key_header)
    event = await append_event(group_id, "expense_added", payload, current_user.id, db, idem_key)
    await db.commit()
    await db.refresh(event)
    await _emit(event)
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

    members = (
        await db.execute(select(GroupMember).where(GroupMember.group_id == group_id))
    ).scalars().all()

    split = _equal_split(body.amount, members)
    paid_by = body.paid_by or current_user.id
    occurred = (body.occurred_at or datetime.now(timezone.utc)).isoformat()

    payload = {
        "expense_id": expense_id,
        "amount": str(body.amount),
        "currency": body.currency,
        "fx_to_default": "1.0000",
        "paid_by": str(paid_by),
        "split": split,
        "description": body.description,
        "occurred_at": occurred,
    }

    idem_key = _parse_idempotency_key(idempotency_key_header)
    event = await append_event(group_id, "expense_edited", payload, current_user.id, db, idem_key)
    await db.commit()
    await db.refresh(event)
    await _emit(event)
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
    await _emit(event)
    return event


@router.post("/{group_id}/payments", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def record_payment(
    group_id: uuid.UUID,
    body: RecordPaymentRequest,
    idempotency_key_header: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_member(group_id, current_user.id, db)

    payload = {
        "from": str(current_user.id),
        "to": str(body.to_user_id),
        "amount": str(body.amount),
        "currency": body.currency,
        "fx_to_default": "1.0000",
    }

    idem_key = _parse_idempotency_key(idempotency_key_header)
    event = await append_event(group_id, "payment_made", payload, current_user.id, db, idem_key)
    await db.commit()
    await db.refresh(event)
    await _emit(event)
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
