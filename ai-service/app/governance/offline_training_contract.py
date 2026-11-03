from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from app.schemas.ai_core import TrainingDatasetManifest


class OfflineTrainingContractError(ValueError):
    """Raised when frozen training evidence does not match its AI Core manifest."""


def _text(value: Any) -> str:
    return str(value or "").strip()


def verify_frozen_training_dataset(
    dataset: Mapping[str, Any],
    manifest: TrainingDatasetManifest,
    *,
    expected_name: str,
    expected_task: str,
) -> None:
    if _text(dataset.get("name")) != _text(expected_name):
        raise OfflineTrainingContractError("Frozen dataset name does not match the training contract.")

    if _text(dataset.get("task")) != _text(expected_task):
        raise OfflineTrainingContractError("Frozen dataset task does not match the training contract.")

    if _text(dataset.get("status")) != "frozen":
        raise OfflineTrainingContractError("Offline training requires a frozen dataset.")

    if _text(dataset.get("featureVersion")) != manifest.feature_definition_version:
        raise OfflineTrainingContractError(
            "Frozen dataset feature version does not match the AI Core manifest."
        )

    scope = dataset.get("scope") or {}
    if _text(scope.get("mode")) != "single_business":
        raise OfflineTrainingContractError(
            "Offline AI Core training currently requires a trusted single-Business dataset."
        )

    if _text(scope.get("business")) != manifest.business_id:
        raise OfflineTrainingContractError(
            "Frozen dataset Business scope does not match the AI Core manifest."
        )

    locations = {
        _text(item)
        for item in (scope.get("locations") or [])
        if _text(item)
    }
    if manifest.location_id not in locations:
        raise OfflineTrainingContractError(
            "Frozen dataset Location scope does not match the AI Core manifest."
        )

    snapshot_count = int(dataset.get("snapshotCount") or 0)
    if snapshot_count != manifest.row_count:
        raise OfflineTrainingContractError(
            "Frozen dataset row count does not match the AI Core manifest."
        )

    if _text(dataset.get("dataHash")).lower() != manifest.sha256_fingerprint:
        raise OfflineTrainingContractError(
            "Frozen dataset fingerprint does not match the AI Core manifest."
        )
