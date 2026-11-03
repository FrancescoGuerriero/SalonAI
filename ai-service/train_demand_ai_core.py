from __future__ import annotations

import argparse
import json
import os
from dataclasses import asdict
from datetime import timezone
from pathlib import Path

from bson import ObjectId
from pymongo import MongoClient

from app.governance.offline_training_contract import verify_frozen_training_dataset
from app.governance.training_manifest_policy import evaluate_training_manifest
from app.schemas.ai_core import TrainingDatasetManifest
from app.training.demand_forecasting import (
    APPROVED_PURPOSE,
    DATASET_KEY,
    FEATURE_VERSION,
    TRACK_KEY,
    DemandObservation,
    run_offline_candidate,
)


CONFIRMATION_TOKEN = "RUN_GOVERNED_OFFLINE_TRAINING"
DATASET_NAME = "salonai-demand-forecast"
TASK = "demand_forecasting"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Validate a governed AI Core demand dataset and run an offline "
            "forecasting candidate evaluation. No production promotion is authorised."
        )
    )
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--dataset-version", required=True)
    parser.add_argument("--model-version", required=True)
    parser.add_argument("--artifact-dir", default="artifacts/demand-forecasting")
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


def mongo_database():
    uri = (
        os.environ.get("MONGODB_URI")
        or os.environ.get("MONGO_URI")
        or ""
    ).strip()
    if not uri:
        raise RuntimeError("MONGODB_URI is required.")

    client = MongoClient(uri)
    database = client.get_default_database()
    if database is None:
        client.close()
        raise RuntimeError("MONGODB_URI must contain a database name.")

    return client, database


def observation_from_snapshot(snapshot: dict) -> DemandObservation:
    as_of = snapshot.get("asOf")
    if as_of is None:
        raise RuntimeError("Demand snapshot is missing asOf.")

    label = snapshot.get("label")
    try:
        bookings = float(label)
    except (TypeError, ValueError) as exc:
        raise RuntimeError("Demand snapshot label must be a numeric booked-appointment count.") from exc

    if bookings < 0:
        raise RuntimeError("Demand snapshot label cannot be negative.")

    features = snapshot.get("features") or {}
    observed = int(features.get("workforce_capacity_observed") or 0)
    if observed not in (0, 1):
        raise RuntimeError(
            "Demand v2 workforce_capacity_observed must be exactly 0 or 1."
        )

    return DemandObservation(
        business_date=as_of.astimezone(timezone.utc).date()
        if getattr(as_of, "tzinfo", None)
        else as_of.date(),
        booked_appointments=bookings,
        available_staff_hours=float(features.get("available_staff_hours") or 0.0),
        appointment_capacity=float(features.get("appointment_capacity") or 0.0),
        workforce_capacity_observed=bool(observed),
    )


def load_governed_observations(
    database,
    manifest: TrainingDatasetManifest,
    dataset_version: str,
) -> list[DemandObservation]:
    try:
        business_id = ObjectId(manifest.business_id)
        location_id = ObjectId(manifest.location_id)
    except Exception as exc:
        raise RuntimeError(
            "Demand offline training currently requires MongoDB ObjectId Business and Location scopes."
        ) from exc

    base_filter = {
        "task": TASK,
        "featureVersion": FEATURE_VERSION,
        "datasetVersion": dataset_version,
    }
    scoped_filter = {
        **base_filter,
        "business": business_id,
        "location": location_id,
    }

    total = database["aifeaturesnapshots"].count_documents(base_filter)
    scoped = database["aifeaturesnapshots"].count_documents(scoped_filter)
    if total != manifest.row_count:
        raise RuntimeError(
            "Frozen demand snapshot count does not match the AI Core manifest; training is blocked."
        )
    if scoped != total:
        raise RuntimeError(
            "Demand snapshots contain records outside the manifest Business/Location scope; training is blocked."
        )

    snapshots = list(
        database["aifeaturesnapshots"].find(scoped_filter).sort("asOf", 1)
    )
    observations = [observation_from_snapshot(item) for item in snapshots]
    if len(observations) != manifest.row_count:
        raise RuntimeError(
            "Loaded demand observations do not match the manifest row count; training is blocked."
        )

    return observations


def validate_training_contract(
    database,
    manifest: TrainingDatasetManifest,
    dataset_version: str,
) -> list[DemandObservation]:
    decision = evaluate_training_manifest(manifest, track_key=TRACK_KEY)

    if manifest.dataset_key != DATASET_KEY:
        raise RuntimeError("Demand training requires the appointments-history AI Core dataset.")
    if manifest.approved_purpose != APPROVED_PURPOSE:
        raise RuntimeError("Demand training requires the demand_forecasting approved purpose.")
    if manifest.feature_definition_version != FEATURE_VERSION:
        raise RuntimeError(
            f"Demand training requires feature contract {FEATURE_VERSION}."
        )

    dataset = database["aitrainingdatasets"].find_one(
        {
            "name": DATASET_NAME,
            "version": dataset_version,
            "task": TASK,
            "featureVersion": FEATURE_VERSION,
        }
    )
    if not dataset:
        raise RuntimeError("Frozen demand training dataset not found for the requested version.")

    verify_frozen_training_dataset(
        dataset,
        manifest,
        expected_name=DATASET_NAME,
        expected_task=TASK,
    )
    observations = load_governed_observations(database, manifest, dataset_version)

    print(
        json.dumps(
            {
                "aiCoreManifestAccepted": decision.accepted,
                "track": decision.track_key,
                "dataset": decision.dataset_key,
                "featureVersion": manifest.feature_definition_version,
                "businessId": decision.business_id,
                "locationId": decision.location_id,
                "rowCount": decision.row_count,
                "offlineTrainingOnly": decision.offline_training_only,
                "productionPromotionAuthorised": decision.production_promotion_authorised,
            },
            indent=2,
        )
    )
    return observations


def write_evaluation_artifact(
    *,
    result,
    manifest: TrainingDatasetManifest,
    dataset_version: str,
    model_version: str,
    artifact_dir: str,
) -> Path:
    destination = Path(artifact_dir)
    destination.mkdir(parents=True, exist_ok=True)
    path = destination / f"{model_version}.evaluation.json"

    payload = {
        "contract": "aiibp_demand_candidate_evaluation_v1",
        "track": TRACK_KEY,
        "modelVersion": model_version,
        "datasetVersion": dataset_version,
        "featureVersion": FEATURE_VERSION,
        "datasetFingerprint": manifest.sha256_fingerprint,
        "businessId": manifest.business_id,
        "locationId": manifest.location_id,
        "result": asdict(result),
        "productionPromotionAuthorised": False,
    }
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return path


def main() -> None:
    args = parse_args()
    if args.confirm_offline_training != CONFIRMATION_TOKEN:
        raise RuntimeError(
            "Offline training was not explicitly confirmed. Pass "
            f"--confirm-offline-training={CONFIRMATION_TOKEN}."
        )

    manifest = load_manifest(args.manifest)
    client, database = mongo_database()
    try:
        observations = validate_training_contract(
            database,
            manifest,
            args.dataset_version,
        )
    finally:
        client.close()

    result = run_offline_candidate(observations)
    artifact_path = write_evaluation_artifact(
        result=result,
        manifest=manifest,
        dataset_version=args.dataset_version,
        model_version=args.model_version,
        artifact_dir=args.artifact_dir,
    )

    print(json.dumps(asdict(result), indent=2))
    print(f"[PASS] Offline demand candidate evaluation written to {artifact_path}.")
    print("[SAFE] No production inference or model promotion was authorised.")


if __name__ == "__main__":
    main()
