from datetime import datetime, timezone

from pydantic import BaseModel, Field


class ServiceMetadata(BaseModel):
    provider_mode: str
    model_name: str
    generated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    rules_applied: list[str] = Field(default_factory=list)
