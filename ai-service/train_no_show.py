from __future__ import annotations

"""Tenant-scope guard for the governed no-show trainer.

The training implementation lives in ``train_no_show_core.py``. This entry
point validates the frozen AiTrainingDataset governance scope and proves that
every matching feature snapshot belongs to that same trusted Business (and,
when configured, allowed Location set) before delegating to the trainer.
Direct raw-production collection training is not permitted.

After training, experiment/candidate artifacts receive a deterministic
``model.manifest.json`` that binds the serialized model to its tenant scope,
frozen dataset hashes, lineage, task, feature schema and artifact checksum.
This wrapper never promotes or activates a model for production inference.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import train_no_show_core as core

from app.governance.model_artifact import (
    build_model_artifact_manifest,
    write_model_artifact_manifest,
)


_ORIGINAL_LOAD_DATASET = core.load_dataset


def _dataset_selector(dataset_version: str) -> dict[str, Any]:
    return {
        "name": "salonai-no-show",
        "version": dataset_version,
        "status": "frozen",
        "task": core.TASK,
        "featureVersion": core.FEATURE_VERSION,
    }


def _snapshot_selector(dataset_version: str) -> dict[str, Any]:
    return {
        "task": core.TASK,
        "featureVersion": core.FEATURE_VERSION,
        "datasetVersion": dataset_version,
        "label": {"$in": [0, 1]},
        "split": {"$in": ["train", "validation", "test"]},
    }


def _trusted_single_business_scope(dataset: dict[str, Any]) -> tuple[Any, list[Any]]:
    scope = dataset.get("scope") or {}

    if scope.get("mode") != "single_business":
        raise RuntimeError(
            "No-show training requires a frozen single_business dataset scope."
        )

    business = scope.get("business")
    if not business:
        raise RuntimeError(
            "Frozen no-show dataset is missing trusted Business provenance."
        )

    if scope.get("deidentified") is not True:
        raise RuntimeError(
            "Frozen no-show dataset must be explicitly marked deidentified."
        )

    locations = list(scope.get("locations") or [])
    return business, locations


def load_tenant_scoped_dataset(database, dataset_version: str):
    dataset = database["aitrainingdatasets"].find_one(
        _dataset_selector(dataset_version)
    )

    if not dataset:
        raise RuntimeError("Frozen no-show training dataset not found.")

    business, locations = _trusted_single_business_scope(dataset)
    snapshot_selector = _snapshot_selector(dataset_version)
    snapshots = database["aifeaturesnapshots"]

    foreign_business_rows = snapshots.count_documents(
        {
            **snapshot_selector,
            "business": {"$ne": business},
        }
    )
    if foreign_business_rows:
        raise RuntimeError(
            "Frozen no-show dataset contains snapshots outside its trusted Business scope."
        )

    if locations:
        foreign_location_rows = snapshots.count_documents(
            {
                **snapshot_selector,
                "business": business,
                "location": {"$nin": locations},
            }
        )
        if foreign_location_rows:
            raise RuntimeError(
                "Frozen no-show dataset contains snapshots outside its governed Location scope."
            )

    loaded_dataset, frame = _ORIGINAL_LOAD_DATASET(database, dataset_version)

    if loaded_dataset.get("_id") != dataset.get("_id"):
        raise RuntimeError(
            "No-show dataset identity changed during tenant-scope validation."
        )

    return loaded_dataset, frame


def _iso_datetime(value: Any) -> str:
    if isinstance(value, datetime):
        candidate = value
        if candidate.tzinfo is None:
            candidate = candidate.replace(tzinfo=timezone.utc)
        return candidate.astimezone(timezone.utc).isoformat()
    return str(value or datetime.now(timezone.utc).isoformat())


def _write_governed_manifest(args) -> Path:
    client, database = core.mongo_database()

    try:
        dataset = database["aitrainingdatasets"].find_one(
            _dataset_selector(args.dataset_version)
        )
        if not dataset:
            raise RuntimeError(
                "Frozen no-show training dataset disappeared before artifact governance."
            )

        model_version = database["aimodelversions"].find_one(
            {
                "name": core.MODEL_NAME,
                "version": args.model_version,
                "task": core.TASK,
                "featureVersion": core.FEATURE_VERSION,
                "lifecycle": {"$in": ["experiment", "candidate"]},
                "trainingDataset": dataset["_id"],
            }
        )
        if not model_version:
            raise RuntimeError(
                "Governed experiment/candidate registry entry was not found after training."
            )

        artifact_dir = (
            Path(args.artifact_dir)
            / args.dataset_version
            / args.model_version
        )
        artifact_path = artifact_dir / "model.joblib"
        manifest_path = artifact_dir / "model.manifest.json"

        thresholds = dict(model_version.get("thresholds") or {})
        threshold = thresholds.get("operational")
        if threshold is None:
            raise RuntimeError(
                "Trained model is missing its operational evaluation threshold."
            )

        manifest = build_model_artifact_manifest(
            model_name=model_version["name"],
            model_version=model_version["version"],
            task=model_version["task"],
            feature_version=model_version["featureVersion"],
            dataset=dataset,
            algorithm=model_version.get("algorithm") or "",
            lifecycle=model_version["lifecycle"],
            selected_threshold=float(threshold),
            artifact_path=artifact_path,
            beats_rules_baseline=model_version["lifecycle"] == "candidate",
            created_at=_iso_datetime(model_version.get("createdAt")),
        )
        write_model_artifact_manifest(manifest, manifest_path)

        governance_metadata = {
            "manifestSchemaVersion": manifest["schemaVersion"],
            "manifestUri": str(manifest_path),
            "artifactSha256": manifest["artifact"]["sha256"],
            "dataset": {
                "id": manifest["dataset"]["id"],
                "version": manifest["dataset"]["version"],
                "schemaHash": manifest["dataset"]["schemaHash"],
                "dataHash": manifest["dataset"]["dataHash"],
                "scope": manifest["dataset"]["scope"],
                "lineage": manifest["dataset"]["lineage"],
            },
        }

        update_result = database["aimodelversions"].update_one(
            {
                "_id": model_version["_id"],
                "lifecycle": {"$in": ["experiment", "candidate"]},
            },
            {
                "$set": {
                    "metadata.governance": governance_metadata,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )
        if update_result.matched_count != 1:
            raise RuntimeError(
                "Model registry state changed before governance metadata could be attached."
            )

        return manifest_path
    finally:
        client.close()


def main() -> None:
    # Parse once before delegation so the same immutable identifiers are used
    # to locate the post-training artifact. core.main() parses the same argv.
    args = core.parse_args()

    # The core training/evaluation pipeline remains authoritative. Only its
    # dataset loader is replaced, so algorithm evaluation and registry output
    # cannot bypass the tenant-governance preflight above.
    core.load_dataset = load_tenant_scoped_dataset
    core.main()

    # This attaches reproducibility/compatibility evidence only. Production
    # approval, promotion and inference activation are intentionally absent.
    _write_governed_manifest(args)


if __name__ == "__main__":
    main()
