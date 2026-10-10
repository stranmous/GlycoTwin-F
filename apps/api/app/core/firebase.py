import os
from functools import lru_cache
from typing import Annotated

import firebase_admin
from fastapi import Depends, Header, HTTPException, status
from firebase_admin import auth as fb_auth, credentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.models.user import User


@lru_cache
def _init_firebase() -> firebase_admin.App | None:
    settings = get_settings()
    if settings.auth_dev_bypass:
        return None
    if not os.path.exists(settings.firebase_credentials_path):
        raise RuntimeError(
            f"Firebase service-account JSON not found at '{settings.firebase_credentials_path}'. "
            "Download it from Firebase console → Project settings → Service accounts → "
            "Generate new private key, then save it there. "
            "Or set AUTH_DEV_BYPASS=true in apps/api/.env to skip auth during development."
        )
    cred = credentials.Certificate(settings.firebase_credentials_path)
    if not firebase_admin._apps:
        options = {}
        if settings.firebase_storage_bucket:
            options["storageBucket"] = settings.firebase_storage_bucket
        return firebase_admin.initialize_app(cred, options)
    return firebase_admin.get_app()


async def verify_firebase_token(
    authorization: Annotated[str | None, Header()] = None,
    session: AsyncSession = Depends(get_session),
) -> User:
    settings = get_settings()

    if settings.auth_dev_bypass and settings.app_env != "development":
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Server misconfiguration")

    # Dev bypass: treat the bearer token as the Firebase UID directly.
    if settings.auth_dev_bypass:
        uid = (authorization or "").removeprefix("Bearer ").strip() or "dev-user"
        email = f"{uid}@dev.local"
    else:
        _init_firebase()
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
        token = authorization.removeprefix("Bearer ").strip()
        try:
            decoded = fb_auth.verify_id_token(token)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from exc
        uid = decoded["uid"]
        email = decoded.get("email") or f"{uid}@unknown"

    result = await session.execute(select(User).where(User.firebase_uid == uid))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(firebase_uid=uid, email=email)
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user


CurrentUser = Annotated[User, Depends(verify_firebase_token)]
