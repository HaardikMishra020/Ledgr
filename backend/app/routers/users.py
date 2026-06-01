import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.friendship import Friendship
from app.models.user import User
from app.schemas.users import FriendRequest, FriendshipResponse, UserSearchResult

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/search", response_model=list[UserSearchResult])
async def search_users(
    q: str = Query(min_length=2, max_length=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pattern = f"%{q}%"
    result = await db.execute(
        select(User)
        .where(
            or_(
                User.display_name.ilike(pattern),
                User.email.ilike(pattern),
            ),
            User.id != current_user.id,
        )
        .limit(20)
    )
    return result.scalars().all()


@router.get("/friends", response_model=list[FriendshipResponse])
async def list_friends(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all accepted friends."""
    rows = (
        await db.execute(
            select(Friendship).where(
                or_(
                    Friendship.requester_id == current_user.id,
                    Friendship.addressee_id == current_user.id,
                ),
                Friendship.status == "accepted",
            )
        )
    ).scalars().all()

    result = []
    for f in rows:
        is_req = f.requester_id == current_user.id
        other_id = f.addressee_id if is_req else f.requester_id
        other = await db.scalar(select(User).where(User.id == other_id))
        if other:
            result.append(
                FriendshipResponse(
                    id=f.id,
                    user_id=other.id,
                    display_name=other.display_name,
                    email=other.email,
                    avatar_url=other.avatar_url if hasattr(other, "avatar_url") else None,
                    status=f.status,
                    is_requester=is_req,
                    created_at=f.created_at,
                )
            )
    return result


@router.get("/friends/requests", response_model=list[FriendshipResponse])
async def list_friend_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List incoming (received) pending friend requests."""
    rows = (
        await db.execute(
            select(Friendship).where(
                Friendship.addressee_id == current_user.id,
                Friendship.status == "pending",
            )
        )
    ).scalars().all()

    result = []
    for f in rows:
        other = await db.scalar(select(User).where(User.id == f.requester_id))
        if other:
            result.append(
                FriendshipResponse(
                    id=f.id,
                    user_id=other.id,
                    display_name=other.display_name,
                    email=other.email,
                    avatar_url=other.avatar_url if hasattr(other, "avatar_url") else None,
                    status=f.status,
                    is_requester=False,
                    created_at=f.created_at,
                )
            )
    return result


@router.get("/friends/sent", response_model=list[FriendshipResponse])
async def list_sent_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List outgoing (sent) pending friend requests."""
    rows = (
        await db.execute(
            select(Friendship).where(
                Friendship.requester_id == current_user.id,
                Friendship.status == "pending",
            )
        )
    ).scalars().all()

    result = []
    for f in rows:
        other = await db.scalar(select(User).where(User.id == f.addressee_id))
        if other:
            result.append(
                FriendshipResponse(
                    id=f.id,
                    user_id=other.id,
                    display_name=other.display_name,
                    email=other.email,
                    avatar_url=other.avatar_url if hasattr(other, "avatar_url") else None,
                    status=f.status,
                    is_requester=True,
                    created_at=f.created_at,
                )
            )
    return result


@router.post("/friends/request", status_code=status.HTTP_201_CREATED)
async def send_friend_request(
    body: FriendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.addressee_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="cannot friend yourself")

    addressee = await db.scalar(select(User).where(User.id == body.addressee_id))
    if not addressee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")

    existing = await db.scalar(
        select(Friendship).where(
            or_(
                (Friendship.requester_id == current_user.id) & (Friendship.addressee_id == body.addressee_id),
                (Friendship.requester_id == body.addressee_id) & (Friendship.addressee_id == current_user.id),
            )
        )
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="friendship already exists")

    f = Friendship(requester_id=current_user.id, addressee_id=body.addressee_id)
    db.add(f)
    await db.commit()
    return {"message": "friend request sent"}


@router.post("/friends/{user_id}/accept", status_code=status.HTTP_200_OK)
async def accept_friend_request(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    f = await db.scalar(
        select(Friendship).where(
            Friendship.requester_id == user_id,
            Friendship.addressee_id == current_user.id,
            Friendship.status == "pending",
        )
    )
    if not f:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="request not found")

    f.status = "accepted"
    await db.commit()
    return {"message": "friend request accepted"}


@router.post("/friends/{user_id}/decline", status_code=status.HTTP_200_OK)
async def decline_friend_request(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    f = await db.scalar(
        select(Friendship).where(
            Friendship.requester_id == user_id,
            Friendship.addressee_id == current_user.id,
            Friendship.status == "pending",
        )
    )
    if not f:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="request not found")

    f.status = "declined"
    await db.commit()
    return {"message": "friend request declined"}


@router.delete("/friends/{user_id}", status_code=status.HTTP_200_OK)
async def remove_friend(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    f = await db.scalar(
        select(Friendship).where(
            or_(
                (Friendship.requester_id == current_user.id) & (Friendship.addressee_id == user_id),
                (Friendship.requester_id == user_id) & (Friendship.addressee_id == current_user.id),
            ),
            Friendship.status == "accepted",
        )
    )
    if not f:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="friend not found")

    await db.delete(f)
    await db.commit()
    return {"message": "friend removed"}
