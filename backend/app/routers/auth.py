from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

UPLOAD_DIR = Path("uploads/avatars")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

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
from app.schemas.users import UserResponse

from app.core.deps import get_current_user
from app.models.user import User as UserModel
from app.schemas.users import UpdateProfileRequest

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


@router.get("/me", response_model=UserResponse)
async def me(current_user: UserModel = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.display_name = body.display_name
    if body.default_currency is not None:
        current_user.default_currency = body.default_currency.upper()
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.put("/me/avatar", response_model=UserResponse)
async def update_avatar(
    file: UploadFile,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="file must be an image")

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin"
    filename = f"{current_user.id}.{ext}"
    dest = UPLOAD_DIR / filename
    dest.write_bytes(await file.read())

    current_user.avatar_url = f"/static/avatars/{filename}"
    await db.commit()
    await db.refresh(current_user)
    return current_user
