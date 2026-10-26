from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ManagementBiMetric(Model):
    key: str = Field(min_length=1, max_length=120)
    version: str = Field(min_length=1, max_length=40)
    label: str = Field(min_length=1, max_length=160)
    value: float
    previous_value: float
    unit: str = Field(min_length=1, max_length=40)
    area: str = Field(min_length=1, max_length=80)


class ManagementBiEvidence(Model):
    contract: Literal["governed_management_evidence_v1"] = "governed_management_evidence_v1"
    business_id: str = Field(min_length=1, max_length=120)
    location_id: str = Field(min_length=1, max_length=120)
    evidence_id: str = Field(min_length=1, max_length=240)
    checksum: str = Field(min_length=32, max_length=128)
    generated_at: datetime
    period_label: str = Field(min_length=1, max_length=120)
    metrics: list[ManagementBiMetric] = Field(min_length=1, max_length=100)


class ManagementBiAnalysisRequest(Model):
    tool_key: Literal["management-copilot"] = "management-copilot"
    requested_action: Literal["analyse", "summarise"] = "analyse"
    evidence: ManagementBiEvidence


class ManagementBiObservation(Model):
    metric_key: str
    direction: Literal["up", "down", "flat", "new_baseline"]
    absolute_change: float
    percent_change: float | None = None
    material: bool
    message: str


class ManagementBiAnalysisResponse(Model):
    registry_version: str
    analysis_version: str
    tool_key: Literal["management-copilot"] = "management-copilot"
    business_id: str
    location_id: str
    evidence_id: str
    checksum: str
    deterministic_baseline: bool = True
    model_inference_executed: bool = False
    execution_authorised: bool = False
    external_write_authorised: bool = False
    human_approval_required: bool = True
    observations: list[ManagementBiObservation]
    message: str
