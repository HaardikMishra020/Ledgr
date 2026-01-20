import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.event import Event
from app.models.group_member import GroupMember
from app.models.user import User
from app.schemas.events import EventResponse
from app.schemas.expenses import AddExpenseRequest

router = APIRouter(prefix="/groups", tags=["expenses"])


def _equal_split(amount: int, members: list) -> list[dict]:
    n = len(members)
    base = amount // n
    remainder = amount % n
    return [
        {"user_id": str(m.user_id), "share": str(base + (remainder if i == 0 else 0))}
        for i, m in enumerate(members)
    ]


@router.post("/{group_id}/expenses", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def add_expense(
    group_id: uuid.UUID,
    body: AddExpenseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member = await db.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not a member of this group")

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

    event = Event(
        group_id=group_id,
        event_type="expense_added",
        event_version=1,
        payload=payload,
        actor_user_id=current_user.id,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event
