"""M4 service: registration, credential check, metabolic profile upsert."""
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.modules.m4_auth.models import MetabolicProfile, User
from app.modules.m4_auth.schemas import ProfileIn, RegisterRequest


async def register_user(db: AsyncSession, payload: RegisterRequest) -> User:
    existing = await db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email is already registered")
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        active_language=payload.active_language,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate(db: AsyncSession, email: str, password: str) -> User:
    user = await db.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None or not verify_password(password, user.password_hash):
        # Same message either way: do not leak which half was wrong.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return user


def issue_token(user: User) -> str:
    return create_access_token(subject=user.id)


async def delete_user(db: AsyncSession, user_id: str) -> None:
    """Erase the account and everything attached to it (WS4 privacy basics).

    The metabolic profile is deleted explicitly rather than relying on the
    FK cascade alone, so deletion is complete even on engines where foreign
    key enforcement is off. JWTs are stateless: after deletion the account
    can no longer log in, and /me resolves the (now missing) user as 404.
    """
    profile = await db.scalar(
        select(MetabolicProfile).where(MetabolicProfile.user_id == user_id)
    )
    if profile is not None:
        await db.delete(profile)
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    await db.delete(user)
    await db.commit()


async def get_user(db: AsyncSession, user_id: str) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


async def upsert_profile(db: AsyncSession, user_id: str, payload: ProfileIn) -> MetabolicProfile:
    profile = await db.scalar(
        select(MetabolicProfile).where(MetabolicProfile.user_id == user_id)
    )
    if profile is None:
        profile = MetabolicProfile(
            user_id=user_id,
            age=payload.age if payload.age is not None else 35,
            weight_kg=payload.weight_kg if payload.weight_kg is not None else 70.0,
            height_cm=payload.height_cm if payload.height_cm is not None else 170.0,
            diabetes_type=payload.diabetes_type or "type2",
            activity_level=payload.activity_level or "moderate",
            medications=payload.medications if payload.medications is not None else [],
            hba1c=payload.hba1c,
        )
        db.add(profile)
    else:
        profile_fields = ("age", "weight_kg", "height_cm", "diabetes_type", "activity_level", "medications", "hba1c")
        for field_name in profile_fields:
            if field_name in payload.model_fields_set:
                setattr(profile, field_name, getattr(payload, field_name))

    user = await db.get(User, user_id)
    if user is not None:
        if "display_name" in payload.model_fields_set and payload.display_name is not None:
            user.display_name = payload.display_name
        if "preferred_language" in payload.model_fields_set and payload.preferred_language is not None:
            user.active_language = payload.preferred_language

    await db.commit()
    await db.refresh(profile)
    return profile



async def get_profile(db: AsyncSession, user_id: str) -> MetabolicProfile:
    profile = await db.scalar(
        select(MetabolicProfile).where(MetabolicProfile.user_id == user_id)
    )
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Metabolic profile not set yet")
    return profile
