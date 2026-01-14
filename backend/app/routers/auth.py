from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    hash_password,
    hash_token,
    new_refresh_token,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPairResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


async def _create_session(user_id: str, db: AsyncSession) -> tuple[str, str]:
    from app.core.config import settings

    raw, token_hash = new_refresh_token()
    session = UserSession(
        user_id=user_id,
        refresh_token_hash=token_hash,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(session)
    return raw, create_access_token(user_id)


@router.post("/register", response_model=TokenPairResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.email == body.email.lower()))
    if existing:
        raise HTTPException(status_code=400, detail="email already registered")

    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    await db.flush()

    refresh_raw, access = await _create_session(str(user.id), db)
    await db.commit()

    return TokenPairResponse(access_token=access, refresh_token=refresh_raw)


@router.post("/login", response_model=TokenPairResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid credentials")

    refresh_raw, access = await _create_session(str(user.id), db)
    await db.commit()

    return TokenPairResponse(access_token=access, refresh_token=refresh_raw)


@router.post("/refresh", response_model=TokenPairResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token_hash = hash_token(body.refresh_token)
    session = await db.scalar(
        select(UserSession).where(UserSession.refresh_token_hash == token_hash)
    )
    if not session or session.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="invalid or expired refresh token")

    await db.delete(session)
    refresh_raw, access = await _create_session(str(session.user_id), db)
    await db.commit()

    return TokenPairResponse(access_token=access, refresh_token=refresh_raw)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token_hash = hash_token(body.refresh_token)
    session = await db.scalar(
        select(UserSession).where(UserSession.refresh_token_hash == token_hash)
    )
    if session:
        await db.delete(session)
        await db.commit()
