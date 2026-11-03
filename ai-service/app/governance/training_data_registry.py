from __future__ import annotations

from copy import deepcopy
from typing import Any


TRAINING_DATA_CATALOGUE_VERSION = "aiibp-training-data-v1"


_TRAINING_DATASETS: tuple[dict[str, Any], ...] = (
    {
        "key": "appointments-history",
        "authority": "canonical_appointments",
        "domains": ["booking", "availability", "appointment-lifecycle"],
        "approvedPurposes": ["no_show_prediction", "demand_forecasting", "capacity_planning"],
        "personalData": "pseudonymised_only",
        "consentOrLawfulBasisRequired": True,
        "tenantScope": "business_and_location",
        "trainingEligible": True,
    },
    {
        "key": "customer-behaviour",
        "authority": "canonical_customer_360",
        "domains": ["customer-360", "customer-lifecycle", "customer-segmentation", "loyalty-ledger"],
        "approvedPurposes": ["retention_modelling", "segmentation_evaluation", "next_best_action"],
        "personalData": "pseudonymised_only",
        "consentOrLawfulBasisRequired": True,
        "tenantScope": "business_and_location",
        "trainingEligible": True,
    },
    {
        "key": "service-and-product-catalogue",
        "authority": "canonical_catalogues",
        "domains": ["service-catalogue", "service-configuration", "inventory"],
        "approvedPurposes": ["recommendation_evaluation", "consultation_support", "demand_forecasting"],
        "personalData": "none_expected",
        "consentOrLawfulBasisRequired": False,
        "tenantScope": "business_and_location",
        "trainingEligible": True,
    },
    {
        "key": "commerce-history",
        "authority": "canonical_commerce",
        "domains": ["orders", "payments", "checkout", "refunds"],
        "approvedPurposes": ["sales_forecasting", "demand_forecasting", "commercial_anomaly_detection"],
        "personalData": "pseudonymised_only",
        "consentOrLawfulBasisRequired": True,
        "tenantScope": "business_and_location",
        "trainingEligible": True,
    },
    {
        "key": "marketing-performance",
        "authority": "aiibp_data_hub",
        "domains": ["marketing-normalised-data", "campaign", "marketing-attribution"],
        "approvedPurposes": ["marketing_advisory", "attribution_evaluation", "campaign_forecasting"],
        "personalData": "aggregated_or_pseudonymised",
        "consentOrLawfulBasisRequired": True,
        "tenantScope": "business_and_location",
        "trainingEligible": True,
    },
    {
        "key": "communications-outcomes",
        "authority": "canonical_communications",
        "domains": ["message-delivery", "communication-channel"],
        "approvedPurposes": ["channel_selection", "response_prediction", "reception_assistance_evaluation"],
        "personalData": "pseudonymised_only",
        "consentOrLawfulBasisRequired": True,
        "tenantScope": "business_and_location",
        "trainingEligible": True,
    },
    {
        "key": "workforce-capacity",
        "authority": "canonical_workforce",
        "domains": ["workforce", "staff-assignment"],
        "approvedPurposes": ["capacity_planning", "demand_forecasting"],
        "personalData": "pseudonymised_only",
        "consentOrLawfulBasisRequired": True,
        "tenantScope": "business_and_location",
        "trainingEligible": True,
    },
    {
        "key": "clinical-records",
        "authority": "canonical_clinical_records",
        "domains": ["clinical-record"],
        "approvedPurposes": [],
        "personalData": "special_category",
        "consentOrLawfulBasisRequired": True,
        "tenantScope": "business_and_location",
        "trainingEligible": False,
        "restriction": "Requires a dedicated regulated-data training policy before any model-development use.",
    },
)


def training_data_snapshot() -> dict[str, Any]:
    return {
        "version": TRAINING_DATA_CATALOGUE_VERSION,
        "datasets": deepcopy(list(_TRAINING_DATASETS)),
        "policy": {
            "canonicalSourceRequired": True,
            "businessAndLocationIsolationRequired": True,
            "crossTenantTrainingDefault": "disabled",
            "rawCredentialsAllowed": False,
            "directIdentifiersAllowed": False,
            "personalDataDefault": "pseudonymise_or_aggregate",
            "consentOrLawfulBasisRequired": True,
            "datasetFingerprintRequired": True,
            "provenanceRequired": True,
            "featureDefinitionVersionRequired": True,
            "baselineComparisonRequired": True,
            "holdoutEvaluationRequired": True,
            "automaticTrainingAllowed": False,
            "productionTrainingAllowed": False,
            "automaticModelPromotionAllowed": False,
            "humanApprovalRequiredForTraining": True,
            "humanApprovalRequiredForPromotion": True,
        },
    }


def registered_training_dataset(dataset_key: str) -> dict[str, Any] | None:
    normalised = str(dataset_key or "").strip().lower()
    for item in _TRAINING_DATASETS:
        if item["key"] == normalised:
            return deepcopy(item)
    return None
