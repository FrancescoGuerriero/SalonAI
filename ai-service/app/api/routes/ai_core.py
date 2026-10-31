from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.security import require_service_key
from app.governance.ai_registry import registry_snapshot
from app.governance.model_development_registry import model_development_snapshot
from app.governance.training_data_registry import (
    registered_training_dataset,
    training_data_snapshot,
)
from app.schemas.ai_core import (
    TrainingDatasetManifest,
    TrainingDatasetManifestValidation,
)


router = APIRouter(
    prefix="/ai-core",
    tags=["ai-core"],
)


def _core_status() -> dict:
    registry = registry_snapshot()
    training_data = registry["trainingData"]
    development = model_development_snapshot()
    datasets = training_data["datasets"]
    models = registry["models"]
    tools = registry["tools"]

    return {
        "module": registry["module"],
        "registryVersion": registry["version"],
        "toolCount": len(tools),
        "modelCount": len(models),
        "modelDevelopmentTrackCount": len(development["tracks"]),
        "trainingDatasetCount": len(datasets),
        "trainingEligibleDatasetCount": sum(
            1 for dataset in datasets if dataset.get("trainingEligible") is True
        ),
        "restrictedDatasetCount": sum(
            1 for dataset in datasets if dataset.get("trainingEligible") is not True
        ),
        "policy": {
            "trainingDefault": registry["policy"]["trainingDefault"],
            "productionModelPromotionDefault": registry["policy"][
                "productionModelPromotionDefault"
            ],
            "automaticModelPromotionAllowed": registry["policy"][
                "automaticModelPromotionAllowed"
            ],
            "crossTenantTrainingDefault": training_data["policy"][
                "crossTenantTrainingDefault"
            ],
            "productionTrainingAllowed": training_data["policy"][
                "productionTrainingAllowed"
            ],
            "humanApprovalRequiredForTraining": training_data["policy"][
                "humanApprovalRequiredForTraining"
            ],
            "humanApprovalRequiredForPromotion": training_data["policy"][
                "humanApprovalRequiredForPromotion"
            ],
            "offlineTrainingOnly": development["policy"]["offlineTrainingOnly"],
            "repeatedRunsForStochasticModelsRequired": development["policy"][
                "repeatedRunsForStochasticModelsRequired"
            ],
        },
        "state": "governed_foundation",
        "message": (
            "AI Core is available as the shared governed AI foundation. "
            "Training and production model promotion remain disabled until an approved "
            "dataset, experiment and promotion workflow authorises them."
        ),
    }


@router.get("/status", dependencies=[Depends(require_service_key)])
def get_ai_core_status(request: Request) -> dict:
    request.state.ai_capability = "ai-core-status"
    return _core_status()


@router.get("/training-data", dependencies=[Depends(require_service_key)])
def get_ai_core_training_data(request: Request) -> dict:
    request.state.ai_capability = "ai-core-training-data"
    return training_data_snapshot()


@router.post(
    "/training-data/validate-manifest",
    response_model=TrainingDatasetManifestValidation,
    dependencies=[Depends(require_service_key)],
)
def validate_ai_core_training_manifest(
    payload: TrainingDatasetManifest,
    request: Request,
) -> TrainingDatasetManifestValidation:
    request.state.ai_capability = "ai-core-training-data-manifest-validation"
    dataset = registered_training_dataset(payload.dataset_key)

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "AI_TRAINING_DATASET_NOT_REGISTERED",
                "message": "Training dataset is not registered by AI Core.",
            },
        )

    if dataset.get("trainingEligible") is not True:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "AI_TRAINING_DATASET_RESTRICTED",
                "message": "Training dataset is restricted by AI Core governance.",
            },
        )

    approved_purposes = {
        str(item)
        for item in dataset.get("approvedPurposes", [])
    }
    if payload.approved_purpose not in approved_purposes:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "AI_TRAINING_PURPOSE_NOT_APPROVED",
                "message": "Requested training purpose is not approved for this dataset.",
            },
        )

    if payload.contains_direct_identifiers:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "AI_TRAINING_DIRECT_IDENTIFIERS_FORBIDDEN",
                "message": "Governed AI training datasets must not contain direct identifiers.",
            },
        )

    if payload.contains_credentials:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "AI_TRAINING_CREDENTIALS_FORBIDDEN",
                "message": "Governed AI training datasets must not contain credentials or secrets.",
            },
        )

    return TrainingDatasetManifestValidation(
        accepted=True,
        dataset_key=payload.dataset_key,
        business_id=payload.business_id,
        location_id=payload.location_id,
        approved_purpose=payload.approved_purpose,
        feature_definition_version=payload.feature_definition_version,
        row_count=payload.row_count,
        sha256_fingerprint=payload.sha256_fingerprint,
        provenance_count=len(payload.provenance_source_ids),
        training_authorised=False,
        production_promotion_authorised=False,
        message=(
            "Training dataset manifest is governance-valid. This validation does not "
            "authorise training, model inference or production model promotion."
        ),
    )


@router.get("/development-tracks", dependencies=[Depends(require_service_key)])
def get_ai_core_development_tracks(request: Request) -> dict:
    request.state.ai_capability = "ai-core-development-tracks"
    return model_development_snapshot()


@router.get("/models", dependencies=[Depends(require_service_key)])
def get_ai_core_models(request: Request) -> dict:
    request.state.ai_capability = "ai-core-models"
    registry = registry_snapshot()
    return {
        "registryVersion": registry["version"],
        "models": registry["models"],
        "policy": {
            "trainingDefault": registry["policy"]["trainingDefault"],
            "productionModelPromotionDefault": registry["policy"][
                "productionModelPromotionDefault"
            ],
            "automaticModelPromotionAllowed": registry["policy"][
                "automaticModelPromotionAllowed"
            ],
        },
    }
