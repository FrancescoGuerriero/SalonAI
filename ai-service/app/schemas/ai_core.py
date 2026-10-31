from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class TrainingDatasetManifest(BaseModel):
    contract: Literal["aiibp_training_dataset_manifest_v1"] = (
        "aiibp_training_dataset_manifest_v1"
    )
    dataset_key: str = Field(min_length=1, max_length=120)
    business_id: str = Field(min_length=1, max_length=120)
    location_id: str = Field(min_length=1, max_length=120)
    approved_purpose: str = Field(min_length=1, max_length=120)
    feature_definition_version: str = Field(min_length=1, max_length=120)
    row_count: int = Field(ge=1, le=100_000_000)
    sha256_fingerprint: str = Field(min_length=64, max_length=64)
    generated_at: datetime
    provenance_source_ids: list[str] = Field(min_length=1, max_length=200)
    contains_direct_identifiers: bool = False
    contains_credentials: bool = False

    @field_validator("sha256_fingerprint")
    @classmethod
    def valid_sha256(cls, value: str) -> str:
        normalised = str(value or "").strip().lower()
        if len(normalised) != 64 or any(
            character not in "0123456789abcdef" for character in normalised
        ):
            raise ValueError("Training dataset fingerprint must be a 64-character SHA-256 hex digest.")
        return normalised

    @field_validator("provenance_source_ids")
    @classmethod
    def clean_provenance(cls, value: list[str]) -> list[str]:
        cleaned = [str(item or "").strip() for item in value]
        if any(not item for item in cleaned):
            raise ValueError("Training dataset provenance source ids must not be empty.")
        if len(set(cleaned)) != len(cleaned):
            raise ValueError("Training dataset provenance source ids must be unique.")
        return cleaned


class TrainingDatasetManifestValidation(BaseModel):
    accepted: bool
    dataset_key: str
    business_id: str
    location_id: str
    approved_purpose: str
    feature_definition_version: str
    row_count: int
    sha256_fingerprint: str
    provenance_count: int
    training_authorised: bool = False
    production_promotion_authorised: bool = False
    message: str
