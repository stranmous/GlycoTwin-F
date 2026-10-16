"""GlycoTwin-FYP API — one FastAPI app, eight modules (M1–M8).

Routers are mounted exactly once each, as their modules land in Phase 3.
Startup fails fast on unsafe configuration (see core/config.validate_runtime).
"""
import os

# Prevent tqdm Errno 22 Invalid argument on Windows non-TTY/background daemon processes
os.environ["TQDM_DISABLE"] = "1"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"

try:
    import transformers.utils.logging as hf_logging
    hf_logging.disable_progress_bar()
except Exception:
    pass

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging

setup_logging()
log = get_logger("glycotwin")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Create tables on boot (dev/demo). Production uses Alembic migrations.

    Fail-soft: stateless modules keep serving if the DB is unreachable; the
    error is logged loudly and auth endpoints will surface it per-request.
    """
    from sqlalchemy.exc import SQLAlchemyError

    try:
        from app.core.db import init_db

        await init_db()
        log.info("Database tables ready")
    except (SQLAlchemyError, OSError, RuntimeError):
        log.exception("Database init failed; M4 auth will error until the DB is reachable")

    # M5 vision model preflight check
    try:
        from app.modules.m5_nutrition.service import verify_vision_weights

        is_healthy, _details, degraded_reasons = verify_vision_weights()
        if is_healthy:
            log.info("M5 vision preflight passed: FastSAM-s, Depth Anything v2, CLIP all verified. Vision mode: models.")
        else:
            reasons_fmt = "\n  - ".join(degraded_reasons)
            log.warning(
                "M5 vision preflight WARNING: missing or truncated model weights!\n"
                "  - %s\n"
                "Remediation command:\n"
                "  python scripts/fetch_weights.py\n"
                "M5 vision pipeline running in degraded/fixture mode.",
                reasons_fmt,
            )
    except Exception:
        log.exception("M5 vision preflight check encountered an unexpected error")

    yield


def create_app() -> FastAPI:
    settings = get_settings()  # raises on unsafe production config
    app = FastAPI(title="GlycoTwin API", version="0.1.0", lifespan=lifespan)

    from app.core.middleware import METRICS, MetricsMiddleware, RateLimitMiddleware

    app.add_middleware(RateLimitMiddleware, rate_per_minute=settings.rate_limit_per_minute)
    app.add_middleware(MetricsMiddleware)

    @app.get("/metrics", tags=["meta"])
    async def metrics() -> dict:
        return METRICS.snapshot()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["meta"])
    async def health() -> dict:
        return {"status": "ok", "environment": settings.environment}

    # --- Module routers (mounted once each as Phase 3 lands them) ---
    from app.modules.m1_ingestion.router import ingest_meal_record
    from app.modules.m1_ingestion.router import router as m1_router

    app.include_router(m1_router, prefix="/api/v1/ingestion", tags=["M1 Ingestion"])
    app.add_api_route(
        "/api/v1/ingestion/meals",
        ingest_meal_record,
        methods=["POST"],
        status_code=200,
        tags=["M1 Ingestion"],
    )

    from app.modules.m2_calibration.router import router as m2_router
    from app.modules.m3_predictive_core.router import router as m3_router

    app.include_router(m2_router, prefix="/api/v1/calibration", tags=["M2 Calibration"])
    app.include_router(m3_router, prefix="/api/v1/predictions", tags=["M3 Predictive Core"])

    from app.modules.m6_simulation.router import router as m6_router

    app.include_router(m6_router, prefix="/api/v1/simulations", tags=["M6 Simulation"])

    from app.modules.m5_nutrition.router import router as m5_router

    app.include_router(m5_router, prefix="/api/v1/nutrition", tags=["M5 Nutrition"])

    from app.modules.m4_auth.router import router as m4_router

    app.include_router(m4_router, prefix="/api/v1/auth", tags=["M4 Auth"])

    from app.modules.m7_insights.router import router as m7_router

    app.include_router(m7_router, prefix="/api/v1/insights", tags=["M7 Insights"])

    from app.modules.m8_coach.router import router as m8_router

    app.include_router(m8_router, prefix="/api/v1/coach", tags=["M8 AI Coach"])

    # Demo frontend (DESIGN D7): a zero-build testing surface, not the app.
    # Waqas's mobile app remains the real client. Served when the directory
    # exists (repo checkout, or /frontend-demo mounted into the container).
    demo_dir = Path(__file__).resolve().parents[2] / "frontend-demo"
    if not demo_dir.exists():
        demo_dir = Path("/frontend-demo")
    if demo_dir.exists():
        app.mount("/demo", StaticFiles(directory=demo_dir, html=True), name="demo")
        log.info("Demo frontend mounted at /demo from %s", demo_dir)

    uploads_dir = Path("uploads")
    uploads_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
    log.info("Uploads mounted at /uploads from %s", uploads_dir.resolve())
    # from app.modules.m2_calibration.router import router as m2_router
    # from app.modules.m3_predictive_core.router import router as m3_router
    # from app.modules.m4_auth.router import router as m4_router
    # from app.modules.m5_nutrition.router import router as m5_router
    # from app.modules.m6_simulation.router import router as m6_router
    # from app.modules.m7_insights.router import router as m7_router
    # from app.modules.m8_coach.router import router as m8_router
    # app.include_router(...)  # one line per module, no duplicates

    log.info("GlycoTwin API initialised (environment=%s)", settings.environment)
    return app


app = create_app()
