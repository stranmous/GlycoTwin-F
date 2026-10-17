"""M4 routes: /api/v1/auth — register, login, me, metabolic profile."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import get_current_user
from app.modules.m4_auth import service
from app.modules.m4_auth.models import MetabolicProfile, User
from app.modules.m4_auth.schemas import (
    AuthResponse,
    LoginRequest,
    ProfileIn,
    ProfileOut,
    RegisterRequest,
    UserOut,
)

router = APIRouter()


def _profile_out(profile: MetabolicProfile, user: User) -> ProfileOut:
    bmi = profile.weight_kg / (profile.height_cm / 100) ** 2
    return ProfileOut(
        user_id=profile.user_id,
        age=profile.age,
        weight_kg=profile.weight_kg,
        height_cm=profile.height_cm,
        diabetes_type=profile.diabetes_type,
        activity_level=profile.activity_level,
        medications=profile.medications or [],
        hba1c=profile.hba1c,
        bmi=round(bmi, 1),
        display_name=user.display_name,
        email=user.email,
        sex=profile.sex,
    )


@router.get("/status")
def status() -> dict[str, str]:
    return {"module": "4", "name": "user-profile-auth", "status": "active"}


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    user = await service.register_user(db, payload)
    return AuthResponse(user=UserOut.model_validate(user, from_attributes=True),
                        access_token=service.issue_token(user))


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    user = await service.authenticate(db, payload.email, payload.password)
    return AuthResponse(user=UserOut.model_validate(user, from_attributes=True),
                        access_token=service.issue_token(user))


@router.get("/me", response_model=UserOut)
async def me(user_id: str = Depends(get_current_user),
             db: AsyncSession = Depends(get_db)) -> UserOut:
    user = await service.get_user(db, user_id)
    return UserOut.model_validate(user, from_attributes=True)


@router.delete("/me")
async def delete_me(user_id: str = Depends(get_current_user),
                    db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Delete the caller's account and metabolic profile (irreversible)."""
    await service.delete_user(db, user_id)
    return {"status": "deleted"}


@router.get("/profile", response_model=ProfileOut)
async def get_profile(user_id: str = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)) -> ProfileOut:
    profile = await service.get_profile(db, user_id)
    current_user = await service.get_user(db, user_id)
    return _profile_out(profile, current_user)


read_profile = get_profile


@router.put("/profile", response_model=ProfileOut)
async def update_profile(payload: ProfileIn,
                         user_id: str = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)) -> ProfileOut:
    profile = await service.upsert_profile(db, user_id, payload)
    current_user = await service.get_user(db, user_id)
    return _profile_out(profile, current_user)


write_profile = update_profile
