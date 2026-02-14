import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
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
