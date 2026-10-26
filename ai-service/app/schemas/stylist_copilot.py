from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StylistCopilotTenantContext(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    business_id: str = Field(alias="businessId", min_length=1, max_length=100)
    location_id: str = Field(alias="locationId", min_length=1, max_length=100)


class StylistCopilotActorContext(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    actor_id: str = Field(alias="actorId", min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=80)
    professional_decision_owner: Literal[True] = Field(
        alias="professionalDecisionOwner"
    )


class StylistCopilotConstraints(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    human_review_required: Literal[True] = Field(alias="humanReviewRequired")
    canonical_writes_allowed: Literal[False] = Field(alias="canonicalWritesAllowed")
    autonomous_customer_messaging_allowed: Literal[False] = Field(
        alias="autonomousCustomerMessagingAllowed"
    )
    medical_diagnosis_allowed: Literal[False] = Field(alias="medicalDiagnosisAllowed")
    safety_rule_override_allowed: Literal[False] = Field(
        alias="safetyRuleOverrideAllowed"
    )


class StylistCopilotRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    capability: Literal["stylist_copilot"]
    definition_version: Literal["1"] = Field(alias="definitionVersion")
    tenant_context: StylistCopilotTenantContext = Field(alias="tenantContext")
    actor_context: StylistCopilotActorContext = Field(alias="actorContext")
    appointment: dict[str, Any] = Field(default_factory=dict)
    consultation: dict[str, Any] = Field(default_factory=dict)
    preferences: dict[str, Any] = Field(default_factory=dict)
    previous_services: list[dict[str, Any]] = Field(
        alias="previousServices", default_factory=list, max_length=50
    )
    previous_products: list[dict[str, Any]] = Field(
        alias="previousProducts", default_factory=list, max_length=50
    )
    follow_up: list[dict[str, Any]] = Field(
        alias="followUp", default_factory=list, max_length=50
    )
    consented_context_keys: list[str] = Field(
        alias="consentedContextKeys", default_factory=list, max_length=50
    )
    constraints: StylistCopilotConstraints

    @field_validator("appointment", "consultation", "preferences")
    @classmethod
    def bound_context(cls, value: dict[str, Any]) -> dict[str, Any]:
        if len(value) > 80:
            raise ValueError("Stylist Copilot context exceeds the supported field limit.")
        return value


class StylistCopilotEvidence(BaseModel):
    source: Literal[
        "appointment",
        "consultation",
        "preferences",
        "previous-service",
        "previous-product",
        "follow-up",
    ]
    key: str
    label: str


class StylistCopilotRecommendation(BaseModel):
    category: Literal["consultation", "service", "product", "aftercare", "follow-up"]
    title: str
    rationale: str
    advisory_only: Literal[True] = Field(alias="advisoryOnly", default=True)
    requires_professional_review: Literal[True] = Field(
        alias="requiresProfessionalReview", default=True
    )
    evidence: list[StylistCopilotEvidence] = Field(default_factory=list)


class StylistCopilotSafetyBoundary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    human_review_required: Literal[True] = Field(alias="humanReviewRequired", default=True)
    canonical_writes_performed: Literal[False] = Field(
        alias="canonicalWritesPerformed", default=False
    )
    autonomous_messages_sent: Literal[False] = Field(
        alias="autonomousMessagesSent", default=False
    )
    safety_override_performed: Literal[False] = Field(
        alias="safetyOverridePerformed", default=False
    )
    medical_diagnosis_performed: Literal[False] = Field(
        alias="medicalDiagnosisPerformed", default=False
    )


class StylistCopilotProvenance(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    provider_mode: str = Field(alias="providerMode")
    model_name: str = Field(alias="modelName")
    model_version: str = Field(alias="modelVersion")
    prompt_version: str = Field(alias="promptVersion")
    feature_version: str = Field(alias="featureVersion")


class StylistCopilotResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    capability: Literal["stylist_copilot"] = "stylist_copilot"
    definition_version: Literal["1"] = Field(alias="definitionVersion", default="1")
    pre_appointment_brief: list[str] = Field(alias="preAppointmentBrief", default_factory=list)
    consultation_summary: list[str] = Field(alias="consultationSummary", default_factory=list)
    history_summary: list[str] = Field(alias="historySummary", default_factory=list)
    recommendations: list[StylistCopilotRecommendation] = Field(default_factory=list)
    attention_flags: list[str] = Field(alias="attentionFlags", default_factory=list)
    confidence: float = Field(ge=0, le=1)
    safety_boundary: StylistCopilotSafetyBoundary = Field(alias="safetyBoundary")
    provenance: StylistCopilotProvenance
