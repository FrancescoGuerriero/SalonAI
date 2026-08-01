from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables or ``.env``."""

    app_name: str = "SalonAI AI Service"
    app_version: str = "4.4.0"
    environment: Literal["development", "test", "production"] = "development"
    host: str = "127.0.0.1"
    port: int = Field(default=8000, ge=1, le=65535)
    log_level: str = "INFO"

    provider_mode: Literal["mock", "openai", "local"] = "mock"
    service_key: str = Field(
        default="development-only-change-this-shared-key",
        min_length=32,
        description="Shared secret used by the Express backend.",
    )

    request_timeout_seconds: float = Field(default=20.0, gt=0, le=120)
    max_request_bytes: int = Field(default=1_000_000, ge=1024, le=10_000_000)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("log_level")
    @classmethod
    def normalise_log_level(cls, value: str) -> str:
        allowed = {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}
        normalised = str(value).strip().upper()
        if normalised not in allowed:
            raise ValueError(f"log_level must be one of: {', '.join(sorted(allowed))}")
        return normalised

    @model_validator(mode="after")
    def reject_development_secret_in_production(self) -> "Settings":
        if self.environment == "production" and self.service_key.startswith("development-"):
            raise ValueError("A production AI service must use a non-development SERVICE_KEY.")
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
