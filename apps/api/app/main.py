from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.routers import coach, insights, me, meals, predictions, simulations


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="GlycoTwin API", version="0.1.0", lifespan=lifespan)

    # In dev allow all origins so browser CORS preflight never blocks.
    # In production, restrict to specific domains via CORS_ORIGINS env var.
    dev_mode = settings.app_env == "development"
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if dev_mode else settings.cors_origin_list,
        allow_credentials=False,  # Must be False when allow_origins=["*"]
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/healthz")
    async def healthz():
        return {"status": "ok"}

    app.include_router(me.router)
    app.include_router(meals.router)
    app.include_router(predictions.router)
    app.include_router(simulations.router)
    app.include_router(insights.router)
    app.include_router(coach.router)

    # Create dir before mounting so StaticFiles always works on first boot.
    os.makedirs(settings.meal_image_dir, exist_ok=True)
    app.mount(
        "/static/meals",
        StaticFiles(directory=settings.meal_image_dir),
        name="meal-images",
    )
    return app


app = create_app()
