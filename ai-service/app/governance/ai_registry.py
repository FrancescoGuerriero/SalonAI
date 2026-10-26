from __future__ import annotations

from copy import deepcopy
from typing import Any


REGISTRY_VERSION = "1.3.0"
ADVISORY_EVALUATION_POLICY_VERSION = "salonai-advisory-evaluation-v1"


_TOOL_REGISTRY: tuple[dict[str, Any], ...] = (
    {
        "key": "haircare-adviser",
        "kind": "tool",
        "route": "/api/v1/haircare",
        "domain": "customer_experience",
        "authority": "canonical_customer_and_service_context",
        "mode": "advisory",
        "humanApprovalRequired": False,
        "externalWriteAllowed": False,
        "evidenceContract": "customer_context",
    },
    {
        "key": "consultation-adviser",
        "kind": "tool",
        "route": "/api/v1/consultation",
        "domain": "consultation",
        "authority": "canonical_consultation_context",
        "mode": "advisory",
        "humanApprovalRequired": False,
        "externalWriteAllowed": False,
        "evidenceContract": "consultation_context",
    },
    {
        "key": "customer-summary",
        "kind": "tool",
        "route": "/api/v1/customer-summary",
        "domain": "crm",
        "authority": "canonical_customer_360",
        "mode": "advisory",
        "humanApprovalRequired": False,
        "externalWriteAllowed": False,
        "evidenceContract": "customer_360",
    },
    {
        "key": "customer-segmentation",
        "kind": "tool",
        "route": "/api/v1/customer-segmentation",
        "domain": "crm",
        "authority": "canonical_customer_and_consent_state",
        "mode": "advisory",
        "humanApprovalRequired": False,
        "externalWriteAllowed": False,
        "evidenceContract": "customer_segments",
    },
    {
        "key": "demand-forecasting",
        "kind": "tool",
        "route": "/api/v1/demand-forecasting",
        "domain": "bi_forecasting",
        "authority": "canonical_operational_history",
        "mode": "predictive",
        "humanApprovalRequired": True,
        "externalWriteAllowed": False,
        "evidenceContract": "operational_time_series",
    },
    {
        "key": "sales-forecasting",
        "kind": "tool",
        "route": "/api/v1/sales-forecasting",
        "domain": "bi_forecasting",
        "authority": "canonical_revenue_history",
        "mode": "predictive",
        "humanApprovalRequired": True,
        "externalWriteAllowed": False,
        "evidenceContract": "revenue_time_series",
    },
    {
        "key": "marketing-insights",
        "kind": "tool",
        "route": "/api/v1/marketing-insights/analyse",
        "domain": "marketing_bi",
        "authority": "aiibp_data_hub",
        "mode": "advisory",
        "humanApprovalRequired": True,
        "externalWriteAllowed": False,
        "evidenceContract": "data_hub_evidence_v1",
        "advisoryPreviewSupported": True,
        "advisoryPreviewRoute": "/api/v1/ai-gateway/advisory-preview",
        "advisoryBaseline": "salonai-canonical-adviser-baseline-v1",
        "advisoryEvaluationPolicy": ADVISORY_EVALUATION_POLICY_VERSION,
        "modelInferenceRequiredForPreview": False,
        "forecastExecutionAuthorised": False,
        "automaticPromotionAllowed": False,
    },
    {
        "key": "no-show-prediction",
        "kind": "tool",
        "route": "/api/v1/no-show-prediction",
        "domain": "appointments",
        "authority": "canonical_appointment_history",
        "mode": "predictive",
        "humanApprovalRequired": True,
        "externalWriteAllowed": False,
        "evidenceContract": "appointment_risk_features",
    },
    {
        "key": "management-copilot",
        "kind": "tool",
        "route": "/api/v1/ai-gateway/management-analysis",
        "domain": "management",
        "authority": "canonical_bi_and_operational_evidence",
        "mode": "advisory",
        "humanApprovalRequired": True,
        "externalWriteAllowed": False,
        "evidenceContract": "governed_management_evidence_v1",
        "deterministicStatisticalBaseline": True,
        "modelInferenceRequired": False,
        "forecastExecutionAuthorised": False,
        "automaticPromotionAllowed": False,
    },
    {
        "key": "whatsapp-bot",
        "kind": "tool",
        "route": "/api/v1/whatsapp-bot",
        "domain": "communications",
        "authority": "canonical_customer_booking_and_consent_context",
        "mode": "conversational",
        "humanApprovalRequired": True,
        "externalWriteAllowed": False,
        "evidenceContract": "conversation_context",
    },
)


_MODEL_REGISTRY: tuple[dict[str, Any], ...] = (
    {
        "key": "consultation-booking-baseline",
        "kind": "model",
        "domain": "consultation",
        "artifactAuthority": "app.governance.model_artifact",
        "promotionState": "governed_artifact_only",
        "productionPromotionAuthorised": False,
        "trainingAuthorised": False,
        "baselineComparisonRequired": True,
    },
    {
        "key": "forecasting-baselines",
        "kind": "model_family",
        "domain": "bi_forecasting",
        "artifactAuthority": "deterministic_statistical_baselines",
        "promotionState": "baseline_first",
        "productionPromotionAuthorised": False,
        "trainingAuthorised": False,
        "baselineComparisonRequired": True,
    },
)


def registry_snapshot() -> dict[str, Any]:
    return {
        "version": REGISTRY_VERSION,
        "tools": deepcopy(list(_TOOL_REGISTRY)),
        "models": deepcopy(list(_MODEL_REGISTRY)),
        "policy": {
            "canonicalFactsRequired": True,
            "tenantContextRequired": True,
            "provenanceRequired": True,
            "humanApprovalForConsequentialActions": True,
            "advisoryEvaluationPolicy": ADVISORY_EVALUATION_POLICY_VERSION,
            "automaticModelPromotionAllowed": False,
            "externalWritesDefault": "disabled",
            "productionModelPromotionDefault": "disabled",
            "trainingDefault": "disabled",
        },
    }


def registered_tool(tool_key: str) -> dict[str, Any] | None:
    normalised = str(tool_key or "").strip().lower()
    for item in _TOOL_REGISTRY:
        if item["key"] == normalised:
            return deepcopy(item)
    return None
