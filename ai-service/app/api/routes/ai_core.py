from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.core.security import require_service_key
from app.governance.ai_registry import registry_snapshot
from app.governance.training_data_registry import training_data_snapshot


router = APIRouter(
    prefix="/ai-core",
    tags=["ai-core"],
)


def _core_status() -> dict:
    registry = registry_snapshot()
    training_data = registry["trainingData"]
    datasets = training_data["datasets"]
    models = registry["models"]
    tools = registry["tools"]

    return {
        "module": registry["module"],
        "registryVersion": registry["version"],
        "toolCount": len(tools),
        "modelCount": len(models),
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
