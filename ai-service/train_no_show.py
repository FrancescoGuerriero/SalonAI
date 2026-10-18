from __future__ import annotations

"""Tenant-scope guard for the governed no-show trainer.

The training implementation lives in ``train_no_show_core.py``. This entry
point deliberately validates the frozen AiTrainingDataset governance scope and
proves that every matching feature snapshot belongs to that same trusted
Business (and, when configured, allowed Location set) before delegating to the
trainer. Direct raw-production collection training is not permitted.
"""

from typing import Any

import train_no_show_core as core


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


def main() -> None:
    # The core training/evaluation pipeline remains authoritative. Only its
    # dataset loader is replaced, so algorithm evaluation and registry output
    # cannot bypass the tenant-governance preflight above.
    core.load_dataset = load_tenant_scoped_dataset
    core.main()


if __name__ == "__main__":
    main()
