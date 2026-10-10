from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    cors_origins: str = "http://localhost:8081,http://localhost:19006,exp://"

    database_url: str = "postgresql+asyncpg://glycotwin:glycotwin@localhost:5432/glycotwin"

    firebase_credentials_path: str = "./firebase-service-account.json"
    auth_dev_bypass: bool = False
    # e.g. "glycotwin-1.firebasestorage.app" — find it in Firebase console → Storage
    firebase_storage_bucket: str = ""

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Used as local fallback when firebase_storage_bucket is not set.
    meal_image_dir: str = "./var/meal-images"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
