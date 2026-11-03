from __future__ import annotations

from dataclasses import dataclass

from app.governance.model_development_registry import model_development_snapshot
from app.governance.training_data_registry import registered_training_dataset
from app.schemas.ai_core import TrainingDatasetManifest


class TrainingManifestPolicyError(ValueError):
    """Raised when an offline training manifest violates AI Core policy."""


@dataclass(frozen=True)
class TrainingManifestDecision:
    accepted: bool
    track_key: str
    dataset_key: str
    business_id: str
    location_id: str
    approved_purpose: str
    feature_definition_version: str
    row_count: int
    sha256_fingerprint: str
    provenance_count: int
    offline_training_only: bool = True
    production_promotion_authorised: bool = False


def _development_track(track_key: str) -> dict:
    normalised = str(track_key or "").strip()
    for track in model_development_snapshot()["tracks"]:
        if track.get("key") == normalised:
            return track
    raise TrainingManifestPolicyError(
        f'Model development track "{normalised}" is not registered by AI Core.'
    )


def evaluate_training_manifest(
    payload: TrainingDatasetManifest,
    *,
    track_key: str,
) -> TrainingManifestDecision:
    """Validate a dataset manifest for an approved offline model-development track.

    Acceptance means the manifest is structurally and governance valid for offline
    experimentation. It never authorises production training, inference, or model
    promotion.
    """

    dataset = registered_training_dataset(payload.dataset_key)
    if dataset is None:
        raise TrainingManifestPolicyError(
            f'Training dataset "{payload.dataset_key}" is not registered by AI Core.'
        )

    if dataset.get("trainingEligible") is not True:
        raise TrainingManifestPolicyError(
            f'Training dataset "{payload.dataset_key}" is restricted by AI Core.'
        )

    approved_purposes = {
        str(item)
        for item in dataset.get("approvedPurposes", [])
    }
    if payload.approved_purpose not in approved_purposes:
        raise TrainingManifestPolicyError(
            f'Training purpose "{payload.approved_purpose}" is not approved for '
            f'dataset "{payload.dataset_key}".'
        )

    if payload.contains_direct_identifiers:
        raise TrainingManifestPolicyError(
            "Governed AI training datasets must not contain direct identifiers."
        )

    if payload.contains_credentials:
        raise TrainingManifestPolicyError(
            "Governed AI training datasets must not contain credentials or secrets."
        )

    if not str(payload.business_id or "").strip():
        raise TrainingManifestPolicyError("A trusted Business scope is required.")

    if not str(payload.location_id or "").strip():
        raise TrainingManifestPolicyError("A trusted Location scope is required.")

    track = _development_track(track_key)
    approved_datasets = {
        str(item)
        for item in track.get("approvedDatasets", [])
    }
    if payload.dataset_key not in approved_datasets:
        raise TrainingManifestPolicyError(
            f'Dataset "{payload.dataset_key}" is not approved for model track '
            f'"{track_key}".'
        )

    policy = model_development_snapshot()["policy"]
    if policy.get("offlineTrainingOnly") is not True:
        raise TrainingManifestPolicyError(
            "AI Core model-development policy must remain offline-training-only."
        )

    return TrainingManifestDecision(
        accepted=True,
        track_key=str(track["key"]),
        dataset_key=payload.dataset_key,
        business_id=payload.business_id,
        location_id=payload.location_id,
        approved_purpose=payload.approved_purpose,
        feature_definition_version=payload.feature_definition_version,
        row_count=payload.row_count,
        sha256_fingerprint=payload.sha256_fingerprint,
        provenance_count=len(payload.provenance_source_ids),
    )
