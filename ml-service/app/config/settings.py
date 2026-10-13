"""
Centralized configuration using Pydantic Settings (12-factor: all config from environment).

Every setting has a sane local-dev default so the service is runnable with zero configuration
(SQLite instead of Postgres, local filesystem instead of MinIO, in-process task execution
instead of a real Celery broker) — see docs/DEPLOYMENT.md for what to override in production.
"""
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Service identity ---
    service_name: str = "placement-ml-service"
    environment: Literal["local", "staging", "production"] = "local"
    api_v1_prefix: str = "/api/v1"
    debug: bool = False

    # --- Security ---
    jwt_secret: str = Field(default="ChangeThisSecretKeyInProductionToSomethingLongAndRandom123456")
    jwt_algorithm: str = "HS256"
    # Must match the Java backend's app.jwt.secret so tokens issued there validate here too.
    require_jwt: bool = False  # set True in production; False keeps local dev frictionless

    # --- Rate limiting ---
    rate_limit_per_minute: int = 120

    # --- Database (Postgres in prod, SQLite fallback for zero-config local dev) ---
    database_url: str = "sqlite+aiosqlite:///./ml_service.db"

    # --- Redis (cache + Celery broker/backend in prod) ---
    redis_url: str = "redis://localhost:6379/0"
    use_redis_cache: bool = False  # False -> in-memory cache fallback for local dev

    # --- Celery (task queue) ---
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    celery_task_always_eager: bool = True  # True -> run tasks synchronously without a broker (local dev)

    # --- Object storage (MinIO/S3 in prod, local filesystem fallback for dev) ---
    storage_backend: Literal["local", "minio"] = "local"
    local_storage_dir: str = "./storage_data"
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "placement-ml"
    minio_secure: bool = False

    # --- External APIs ---
    youtube_api_key: str | None = None  # required for real YouTube Data API calls; None -> stub results

    # --- LLM provider for resume/JD-based question generation (see app/services/llm/) ---
    # "ollama" (free, local, default), "gemini" (needs GEMINI_API_KEY), or "mock" (no network).
    # SECURITY: never hardcode a real API key here or anywhere in source — set it in a local
    # .env file (gitignored) or your deployment's secret manager instead.
    llm_provider: Literal["ollama", "gemini", "mock"] = "ollama"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-1.5-flash"

    # --- Model configuration (frame sampling, thresholds) ---
    frame_sample_interval_seconds: float = 2.0
    face_confidence_min_size: int = 60
    important_frame_score_delta: float = 15.0  # only persist a frame if its score jumps by this much

    # --- Logging / observability ---
    log_level: str = "INFO"
    log_json: bool = True

    # --- CORS ---
    cors_allow_origins: list[str] = ["http://localhost:3000", "http://localhost:8080"]


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance — read once per process, overridable in tests via
    `get_settings.cache_clear()` + monkeypatching environment variables."""
    return Settings()
