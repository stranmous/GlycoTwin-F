"""Application settings — the single source of configuration.

Ported from GlycoTwin-AI-Core's config approach (environment-driven), with the
Phase 2 hardening baked in: in production mode the app refuses to boot with a
placeholder JWT secret (the old repo shipped one in docker-compose.yml).
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

PLACEHOLDER_SECRETS = {"", "change-me", "change-me-to-a-long-random-string",
                       "super_secret_key_change_in_production", "secret"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    # Auth (M4)
    jwt_secret: str = "change-me-to-a-long-random-string"
    jwt_algorithm: str = "HS256"
    # SEC-6: sessions last 30 minutes. There are no refresh tokens by design
    # (demo sessions fit comfortably inside one token lifetime); a longer
    # lifetime can be set via JWT_EXPIRE_MINUTES for special deployments.
    jwt_expire_minutes: int = 30

    # Database / cache: async SQLAlchemy; sqlite default keeps local dev and
    # tests zero-config, Postgres is injected by docker-compose.
    database_url: str = "sqlite+aiosqlite:///./glycotwin.db"
    redis_url: str = "redis://localhost:6379/0"

    # CORS: explicit origins only, never "*" with credentials (D6).
    # Defaults cover local frontend development (Vite/Expo/Next + the demo
    # console); production sets CORS_ORIGINS to the real frontend origin.
    # Native mobile clients send no Origin and are unaffected.
    cors_origins: str = (
        "http://localhost:8000,http://localhost:5173,http://localhost:8081,"
        "http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:8081"
    )

    # M5 meal pipeline (weights live outside git; see backend/weights/)
    meal_max_upload_mb: int = 10
    # WS4 hardening: per-IP request budget and metrics endpoint
    rate_limit_per_minute: int = 120
    # M3 trained residual weights (WS1). Empty = physics + explicit placeholder.
    # Set to the .pt path only after ml.evaluate's ship gate passes.
    m3_residual_weights: str = ""
    fastsam_model_path: str = "weights/FastSAM-s.pt"
    depth_anything_model_path: str = "weights/depth-anything-v2-small-hf"
    clip_model_path: str = "weights/clip-vit-base-patch32"
    depth_model_device: str = "cpu"
    pinecone_api_key: str = ""
    pinecone_index: str = ""

    # M8 coach
    llm_provider: str = ""
    llm_api_key: str = ""

    # LI-3 at-rest field encryption (see app/core/crypto.py). Fernet key
    # (32 urlsafe-b64 bytes); generate with `python scripts/gen_key.py`.
    # Empty in dev/test falls back to a process-ephemeral key with a warning.
    db_encryption_key: str = ""
    # Provider-specific LLM settings (previously read via os.getenv in
    # llm_provider.py; consolidated here so Settings is the single source).
    gemini_api_key: str = ""
    openai_api_key: str = ""
    gemini_model: str = "gemini-3-flash-preview"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def validate_runtime(self) -> None:
        """Fail fast on unsafe configuration. Called once at startup."""
        secret_unsafe = (
            self.jwt_secret.strip().lower() in PLACEHOLDER_SECRETS
            or len(self.jwt_secret) < 32
        )
        if self.environment.lower() == "production" and secret_unsafe:
            raise RuntimeError(
                "Refusing to boot in production: JWT_SECRET is a placeholder "
                "or too short. Set a long random JWT_SECRET in .env."
            )
        # LI-3: at-rest field encryption needs a real Fernet key in production.
        # Validated here (not merely "non-empty") so a truncated or mistyped
        # key fails at boot instead of corrupting reads at query time.
        if self.environment.lower() == "production":
            from cryptography.fernet import Fernet

            try:
                Fernet(self.db_encryption_key.encode("utf-8"))
            except Exception:  # noqa: BLE001 — any parse failure fails closed
                raise RuntimeError(
                    "Refusing to boot in production: DB_ENCRYPTION_KEY is "
                    "missing or not a valid Fernet key. Generate one with "
                    "`python scripts/gen_key.py` and set DB_ENCRYPTION_KEY."
                ) from None


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_runtime()
    return settings
