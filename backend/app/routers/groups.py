import uuid
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.fx.rates import get_rate
from app.models.group import Group
from app.models.group_member import GroupMember
from app.models.user import User
from app.projection.delta import compute_balances
from app.schemas.groups import GroupCreate, GroupResponse
from app.schemas.settlement import SettlementResponse
from app.settlement.minflow import settle_minflow

router = APIRouter(prefix="/groups", tags=["groups"])


class MemberResponse(BaseModel):
    user_id: str
    display_name: str
    email: str
    role: str
    joined_at: str


class AddMemberBody(BaseModel):
    user_id: Optional[uuid.UUID] = None
    email: Optional[str] = None


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    body: GroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = Group(
        name=body.name,
        default_currency=body.default_currency,
        created_by=current_user.id,
        icon=body.icon,
    )
    db.add(group)
    await db.flush()

    member = GroupMember(group_id=group.id, user_id=current_user.id, role="owner")
    db.add(member)
    await db.commit()
    await db.refresh(group)
    return group


@router.get("", response_model=list[GroupResponse])
async def list_groups(
    status: Optional[str] = Query(default="active"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Group)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .where(GroupMember.user_id == current_user.id)
    )
    if status:
        q = q.where(Group.status == status)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/balances")
async def list_group_balances(
    summary_currency: str = Query(default="INR"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Net balance per group for the current user (dashboard summary).
    All balances also converted to summary_currency for cross-group totals."""
    rows = (
        await db.execute(
            select(Group)
            .join(GroupMember, GroupMember.group_id == Group.id)
            .where(
                GroupMember.user_id == current_user.id,
                Group.status == "active",
            )
        )
    ).scalars().all()

    result = []
    uid = str(current_user.id)
    for group in rows:
        balances = await compute_balances(group.id, db, default_currency=group.default_currency)
        user_balances = balances.get(uid, {})
        net = sum(user_balances.values())

        fx = await get_rate(group.default_currency, summary_currency, db)
        net_summary = int(Decimal(str(net)) * fx)

        result.append({
            "group_id": str(group.id),
            "group_name": group.name,
            "icon": group.icon,
            "currency": group.default_currency,
            "net_balance": net,
            "net_balance_summary": net_summary,
            "summary_currency": summary_currency,
        })
    return result


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: uuid.UUID,
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="group not found")

    group = await db.scalar(select(Group).where(Group.id == group_id))
    return group


@router.patch("/{group_id}/archive", response_model=GroupResponse)
async def archive_group(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member = await db.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
            GroupMember.role == "owner",
        )
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only owner can archive group")

    group = await db.scalar(select(Group).where(Group.id == group_id))
    group.status = "archived"
    await db.commit()
    await db.refresh(group)
    return group


@router.get("/{group_id}/members", response_model=list[MemberResponse])
async def get_members(
    group_id: uuid.UUID,
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="group not found")

    rows = (
        await db.execute(
            select(GroupMember, User)
            .join(User, User.id == GroupMember.user_id)
            .where(GroupMember.group_id == group_id)
            .order_by(GroupMember.joined_at)
        )
    ).all()

    return [
        MemberResponse(
            user_id=str(m.user_id),
            display_name=u.display_name,
            email=u.email,
            role=m.role,
            joined_at=m.joined_at.isoformat(),
        )
        for m, u in rows
    ]


@router.get("/{group_id}/balances")
async def get_balances(
    group_id: uuid.UUID,
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="group not found")

    group = await db.scalar(select(Group).where(Group.id == group_id))
    balances = await compute_balances(group_id, db, default_currency=group.default_currency)
    return {"balances": balances}


@router.get("/{group_id}/settlement", response_model=SettlementResponse)
async def get_settlement(
    group_id: uuid.UUID,
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="group not found")

    group = await db.scalar(select(Group).where(Group.id == group_id))
    balances = await compute_balances(group_id, db, default_currency=group.default_currency)
    transactions = settle_minflow(balances)
    return SettlementResponse(transactions=transactions)


@router.post("/{group_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(
    group_id: uuid.UUID,
    body: AddMemberBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add an existing Ledgr user to a group directly (owner or member can invite)."""
    caller_membership = await db.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if not caller_membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not a group member")

    if not body.user_id and not body.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="provide user_id or email")

    if body.user_id:
        target = await db.scalar(select(User).where(User.id == body.user_id))
    else:
        target = await db.scalar(select(User).where(User.email == body.email))

    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")

    existing = await db.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == target.id,
        )
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="user already a member")

    member = GroupMember(group_id=group_id, user_id=target.id, role="member")
    db.add(member)
    await db.commit()
    return {"message": "member added", "user_id": str(target.id)}
