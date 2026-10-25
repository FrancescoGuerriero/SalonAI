from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class ProvenanceReference(BaseModel):
    source_type: str = Field(min_length=1, max_length=80)
    source_id: str = Field(min_length=1, max_length=240)
    provider: str | None = Field(default=None, max_length=80)
    generated_at: datetime | None = None


class CanonicalFact(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    value: float | int | str | bool | None
    unit: str | None = Field(default=None, max_length=40)
    dimensions: dict[str, str] = Field(default_factory=dict)

    @field_validator("dimensions")
    @classmethod
    def bound_dimensions(cls, value: dict[str, str]) -> dict[str, str]:
        if len(value) > 20:
            raise ValueError("A canonical fact may contain at most 20 dimensions.")
        return {
            str(key)[:80]: str(item)[:240]
            for key, item in value.items()
        }


class DataHubEvidenceEnvelope(BaseModel):
    contract: Literal["data_hub_evidence_v1"] = "data_hub_evidence_v1"
    business_id: str = Field(min_length=1, max_length=120)
    location_id: str = Field(min_length=1, max_length=120)
    evidence_id: str = Field(min_length=1, max_length=240)
    generated_at: datetime
    facts: list[CanonicalFact] = Field(min_length=1, max_length=500)
    provenance: list[ProvenanceReference] = Field(min_length=1, max_length=200)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("metadata")
    @classmethod
    def reject_secret_like_metadata(cls, value: dict[str, Any]) -> dict[str, Any]:
        forbidden = (
            "password",
            "secret",
            "token",
            "api_key",
            "apikey",
            "authorization",
            "credential",
        )
        for key in value:
            lowered = str(key).lower()
            if any(term in lowered for term in forbidden):
                raise ValueError("Evidence metadata must not contain credentials or secrets.")
        if len(value) > 50:
            raise ValueError("Evidence metadata may contain at most 50 entries.")
        return value


class GatewayPlanRequest(BaseModel):
    tool_key: str = Field(min_length=1, max_length=120)
    evidence: DataHubEvidenceEnvelope
    requested_action: Literal["analyse", "summarise", "forecast", "recommend"] = "analyse"


class GatewayPlanResponse(BaseModel):
    registry_version: str
    tool_key: str
    route: str
    mode: str
    evidence_contract: str
    evidence_accepted: bool
    fact_count: int
    provenance_count: int
    execution_authorised: bool = False
    external_write_authorised: bool = False
    human_approval_required: bool
    message: str
