from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from bson import ObjectId

from app.governance.offline_training_contract import verify_frozen_training_dataset
from app.governance.training_manifest_policy import evaluate_training_manifest
from app.schemas.ai_core import TrainingDatasetManifest
import train_no_show_core as core_trainer


CONFIRMATION_TOKEN = "RUN_GOVERNED_OFFLINE_TRAINING"
TRACK_KEY = "no-show-risk"
DATASET_KEY = "appointments-history"
APPROVED_PURPOSE = "no_show_prediction"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Validate an AI Core dataset manifest and then run the existing SalonAI "
            "no-show trainer in the controlled offline training environment."
        )
    )
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--dataset-version", required=True)
    parser.add_argument("--model-version", required=True)
    parser.add_argument("--artifact-dir", default="artifacts/no-show")
    parser.add_argument("--confirm-offline-training", required=True)
    return parser.parse_args()


def load_manifest(path: str) -> TrainingDatasetManifest:
    manifest_path = Path(path)
    if not manifest_path.is_file():
        raise RuntimeError(f"AI Core training manifest not found: {manifest_path}")

    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError("AI Core training manifest must be valid UTF-8 JSON.") from exc

    return TrainingDatasetManifest.model_validate(payload)


def verify_snapshot_scope(database, manifest: TrainingDatasetManifest, dataset_version: str) -> None:
    try:
        business_id = ObjectId(manifest.business_id)
        location_id = ObjectId(manifest.location_id)
    except Exception as exc:
        raise RuntimeError(
            "No-show offline training currently requires MongoDB ObjectId Business and Location scopes."
        ) from exc

    base_filter = {
        "task": core_trainer.TASK,
        "featureVersion": core_trainer.FEATURE_VERSION,
        "datasetVersion": dataset_version,
    }
    total = database["aifeaturesnapshots"].count_documents(base_filter)
    scoped = database["aifeaturesnapshots"].count_documents(
        {
            **base_filter,
            "business": business_id,
            "location": location_id,
        }
    )

    if total != manifest.row_count:
        raise RuntimeError(
            "Frozen snapshot count does not match the AI Core manifest; training is blocked."
        )

    if scoped != total:
        raise RuntimeError(
            "Frozen snapshots contain records outside the manifest Business/Location scope; training is blocked."
        )


def validate_training_contract(database, manifest: TrainingDatasetManifest, dataset_version: str) -> None:
    decision = evaluate_training_manifest(manifest, track_key=TRACK_KEY)

    if manifest.dataset_key != DATASET_KEY:
        raise RuntimeError("No-show training requires the appointments-history AI Core dataset.")

    if manifest.approved_purpose != APPROVED_PURPOSE:
        raise RuntimeError("No-show training requires the no_show_prediction approved purpose.")

    dataset = database["aitrainingdatasets"].find_one(
        {
            "name": core_trainer.DATASET_NAME,
            "version": dataset_version,
            "task": core_trainer.TASK,
            "featureVersion": core_trainer.FEATURE_VERSION,
        }
    )
    if not dataset:
        raise RuntimeError("Frozen no-show training dataset not found for the requested version.")

    verify_frozen_training_dataset(
        dataset,
        manifest,
        expected_name=core_trainer.DATASET_NAME,
        expected_task=core_trainer.TASK,
    )
    verify_snapshot_scope(database, manifest, dataset_version)

    print(
        json.dumps(
            {
                "aiCoreManifestAccepted": decision.accepted,
                "track": decision.track_key,
                "dataset": decision.dataset_key,
                "businessId": decision.business_id,
                "locationId": decision.location_id,
                "rowCount": decision.row_count,
                "offlineTrainingOnly": decision.offline_training_only,
                "productionPromotionAuthorised": decision.production_promotion_authorised,
            },
            indent=2,
        )
    )


def main() -> None:
    args = parse_args()

    if args.confirm_offline_training != CONFIRMATION_TOKEN:
        raise RuntimeError(
            "Offline training was not explicitly confirmed. Pass "
            f"--confirm-offline-training={CONFIRMATION_TOKEN}."
        )

    manifest = load_manifest(args.manifest)
    client, database = core_trainer.mongo_database()

    try:
        validate_training_contract(database, manifest, args.dataset_version)
    finally:
        client.close()

    sys.argv = [
        "train_no_show_core.py",
        "--dataset-version",
        args.dataset_version,
        "--model-version",
        args.model_version,
        "--artifact-dir",
        args.artifact_dir,
    ]
    core_trainer.main()


if __name__ == "__main__":
    main()
