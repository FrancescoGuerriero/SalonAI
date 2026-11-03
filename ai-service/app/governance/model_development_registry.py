from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.governance.training_data_registry import registered_training_dataset


MODEL_DEVELOPMENT_REGISTRY_VERSION = "aiibp-model-development-v1"


_MODEL_DEVELOPMENT_TRACKS: tuple[dict[str, Any], ...] = (
    {
        "key": "no-show-risk",
        "purpose": "Predict appointment non-attendance risk for human-reviewed interventions.",
        "taskType": "binary_classification",
        "approvedDatasets": ["appointments-history"],
        "targetDefinition": "appointment_attended_within_scheduled_window",
        "baseline": "historical_location_no_show_rate",
        "primaryMetrics": ["roc_auc", "pr_auc", "brier_score"],
        "secondaryMetrics": ["recall_at_review_threshold", "precision_at_review_threshold"],
        "fairnessReviewRequired": True,
        "calibrationRequired": True,
        "humanReviewRequired": True,
        "trainingAuthorised": False,
        "productionPromotionAuthorised": False,
    },
    {
        "key": "demand-forecasting",
        "purpose": "Forecast booking demand and capacity pressure for planning.",
        "taskType": "time_series_forecasting",
        "approvedDatasets": ["appointments-history", "workforce-capacity"],
        "targetDefinition": "bookings_or_service_minutes_by_location_time_bucket",
        "baseline": "seasonal_naive",
        "primaryMetrics": ["mae", "wape"],
        "secondaryMetrics": ["rmse", "forecast_bias"],
        "fairnessReviewRequired": False,
        "calibrationRequired": False,
        "humanReviewRequired": True,
        "trainingAuthorised": False,
        "productionPromotionAuthorised": False,
    },
    {
        "key": "sales-forecasting",
        "purpose": "Forecast governed revenue and commercial demand for business planning.",
        "taskType": "time_series_forecasting",
        "approvedDatasets": ["commerce-history", "marketing-performance"],
        "targetDefinition": "net_revenue_by_location_time_bucket",
        "baseline": "seasonal_naive",
        "primaryMetrics": ["mae", "wape"],
        "secondaryMetrics": ["rmse", "forecast_bias"],
        "fairnessReviewRequired": False,
        "calibrationRequired": False,
        "humanReviewRequired": True,
        "trainingAuthorised": False,
        "productionPromotionAuthorised": False,
    },
    {
        "key": "retention-risk",
        "purpose": "Estimate customer rebooking or retention risk to support human-reviewed next actions.",
        "taskType": "binary_classification",
        "approvedDatasets": [
            "customer-behaviour",
            "appointments-history",
            "communications-outcomes",
        ],
        "targetDefinition": "customer_rebooks_within_governed_horizon",
        "baseline": "historical_segment_rebooking_rate",
        "primaryMetrics": ["roc_auc", "pr_auc", "brier_score"],
        "secondaryMetrics": ["lift_at_review_capacity", "calibration_error"],
        "fairnessReviewRequired": True,
        "calibrationRequired": True,
        "humanReviewRequired": True,
        "trainingAuthorised": False,
        "productionPromotionAuthorised": False,
    },
    {
        "key": "service-product-recommendation",
        "purpose": "Rank relevant services or products using authorised customer and catalogue evidence.",
        "taskType": "ranking",
        "approvedDatasets": ["customer-behaviour", "service-and-product-catalogue"],
        "targetDefinition": "relevant_service_or_product_interaction",
        "baseline": "location_popularity_ranking",
        "primaryMetrics": ["ndcg_at_k", "recall_at_k"],
        "secondaryMetrics": ["catalogue_coverage", "diversity_at_k"],
        "fairnessReviewRequired": True,
        "calibrationRequired": False,
        "humanReviewRequired": True,
        "trainingAuthorised": False,
        "productionPromotionAuthorised": False,
    },
)


def _validated_track(track: dict[str, Any]) -> dict[str, Any]:
    validated = deepcopy(track)
    for dataset_key in validated["approvedDatasets"]:
        dataset = registered_training_dataset(dataset_key)
        if dataset is None:
            raise RuntimeError(
                f'Model development track "{validated["key"]}" references unknown dataset "{dataset_key}".'
            )
        if dataset.get("trainingEligible") is not True:
            raise RuntimeError(
                f'Model development track "{validated["key"]}" references restricted dataset "{dataset_key}".'
            )
    return validated


def model_development_snapshot() -> dict[str, Any]:
    tracks = [_validated_track(track) for track in _MODEL_DEVELOPMENT_TRACKS]
    return {
        "version": MODEL_DEVELOPMENT_REGISTRY_VERSION,
        "tracks": tracks,
        "policy": {
            "offlineTrainingOnly": True,
            "trainingRequiresExplicitApproval": True,
            "holdoutEvaluationRequired": True,
            "baselineComparisonRequired": True,
            "datasetFingerprintRequired": True,
            "provenanceRequired": True,
            "repeatedRunsForStochasticModelsRequired": True,
            "automaticTrainingAllowed": False,
            "automaticProductionPromotionAllowed": False,
        },
    }
