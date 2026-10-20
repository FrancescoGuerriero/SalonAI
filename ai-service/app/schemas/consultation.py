from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ConsultationTenantContext(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    business_id: str = Field(alias="businessId", min_length=1, max_length=100)
    location_id: str = Field(alias="locationId", min_length=1, max_length=100)


class ConsultationRuleFlag(BaseModel):
    code: str = Field(min_length=1, max_length=120)
    severity: Literal["info", "attention", "blocking"]
    label: str = Field(min_length=1, max_length=500)
    source: Literal["rule"] = "rule"


class ConsultationDeterministicAssessment(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    ruleset_version: str = Field(alias="rulesetVersion", min_length=1, max_length=120)
    complete: bool
    missing_fields: list[str] = Field(alias="missingFields", default_factory=list, max_length=32)
    required_human_review: Literal[True] = Field(alias="requiredHumanReview")
    booking_blocked: bool = Field(alias="bookingBlocked")
    flags: list[ConsultationRuleFlag] = Field(default_factory=list, max_length=32)


class ConsultationConstraints(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    human_review_required: Literal[True] = Field(alias="humanReviewRequired")
    deterministic_booking_block: bool = Field(alias="deterministicBookingBlock")
    canonical_writes_allowed: Literal[False] = Field(alias="canonicalWritesAllowed")
    medical_diagnosis_allowed: Literal[False] = Field(alias="medicalDiagnosisAllowed")
    safety_rule_override_allowed: Literal[False] = Field(alias="safetyRuleOverrideAllowed")


class ConsultationAssistanceRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    capability: Literal["consultation_assistance"]
    consultation_type: Literal["hair-colour-chemical"] = Field(alias="consultationType")
    definition_version: Literal["1"] = Field(alias="definitionVersion")
    tenant_context: ConsultationTenantContext = Field(alias="tenantContext")
    features: dict[str, Any] = Field(default_factory=dict)
    deterministic_assessment: ConsultationDeterministicAssessment = Field(
        alias="deterministicAssessment"
    )
    constraints: ConsultationConstraints

    @field_validator("features")
    @classmethod
    def bound_feature_payload(cls, value: dict[str, Any]) -> dict[str, Any]:
        if len(value) > 40:
            raise ValueError("Consultation feature payload exceeds the supported field limit.")
        return value


class ConsultationAttentionFlag(BaseModel):
    code: str
    severity: Literal["info", "attention", "blocking"]
    label: str


class ConsultationSafetyBoundary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    human_review_required: Literal[True] = Field(alias="humanReviewRequired", default=True)
    deterministic_booking_block: bool = Field(alias="deterministicBookingBlock")
    booking_authorised: Literal[False] = Field(alias="bookingAuthorised", default=False)
    canonical_writes_performed: Literal[False] = Field(
        alias="canonicalWritesPerformed", default=False
    )
    safety_override_performed: Literal[False] = Field(
        alias="safetyOverridePerformed", default=False
    )
    medical_diagnosis_performed: Literal[False] = Field(
        alias="medicalDiagnosisPerformed", default=False
    )


class ConsultationAiProvenance(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    provider_mode: str = Field(alias="providerMode")
    model_name: str = Field(alias="modelName")
    model_version: str = Field(alias="modelVersion")
    prompt_version: str = Field(alias="promptVersion")
    feature_version: str = Field(alias="featureVersion")
    dataset_version: str = Field(alias="datasetVersion")


class ConsultationAssistanceResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    capability: Literal["consultation_assistance"] = "consultation_assistance"
    consultation_type: Literal["hair-colour-chemical"] = Field(
        alias="consultationType", default="hair-colour-chemical"
    )
    definition_version: Literal["1"] = Field(alias="definitionVersion", default="1")
    extracted_features: dict[str, Any] = Field(alias="extractedFeatures")
    incomplete_fields: list[str] = Field(alias="incompleteFields")
    recommendation: dict[str, Any]
    confidence: float = Field(ge=0, le=1)
    rationale: list[str] = Field(default_factory=list)
    attention_flags: list[ConsultationAttentionFlag] = Field(
        alias="attentionFlags", default_factory=list
    )
    safety_boundary: ConsultationSafetyBoundary = Field(alias="safetyBoundary")
    provenance: ConsultationAiProvenance
