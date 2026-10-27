from datetime import datetime, timezone

import pytest

from app.governance.offline_training_contract import (
    OfflineTrainingContractError,
    verify_frozen_training_dataset,
)
from app.schemas.ai_core import TrainingDatasetManifest


def manifest(**overrides) -> TrainingDatasetManifest:
    values = {
        "dataset_key": "appointments-history",
        "business_id": "507f1f77bcf86cd799439011",
        "location_id": "507f1f77bcf86cd799439012",
        "approved_purpose": "no_show_prediction",
        "feature_definition_version": "no-show-v1",
        "row_count": 120,
        "sha256_fingerprint": "b" * 64,
        "generated_at": datetime(2026, 10, 27, tzinfo=timezone.utc),
        "provenance_source_ids": ["appointments-history-v1"],
    }
    values.update(overrides)
    return TrainingDatasetManifest(**values)


def frozen_dataset(**overrides):
    values = {
        "name": "salonai-no-show",
        "task": "no_show_prediction",
        "status": "frozen",
        "featureVersion": "no-show-v1",
        "snapshotCount": 120,
        "dataHash": "b" * 64,
        "scope": {
            "mode": "single_business",
            "business": "507f1f77bcf86cd799439011",
            "locations": ["507f1f77bcf86cd799439012"],
        },
    }
    values.update(overrides)
    return values


def verify(dataset=None, payload=None):
    verify_frozen_training_dataset(
        dataset or frozen_dataset(),
        payload or manifest(),
        expected_name="salonai-no-show",
        expected_task="no_show_prediction",
    )


def test_matching_frozen_dataset_is_accepted():
    verify()


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("status", "draft", "frozen"),
        ("featureVersion", "no-show-v2", "feature version"),
        ("snapshotCount", 119, "row count"),
        ("dataHash", "c" * 64, "fingerprint"),
    ],
)
def test_frozen_dataset_contract_rejects_metadata_mismatch(field, value, message):
    with pytest.raises(OfflineTrainingContractError, match=message):
        verify(frozen_dataset(**{field: value}))


def test_frozen_dataset_contract_rejects_business_scope_mismatch():
    dataset = frozen_dataset()
    dataset["scope"] = {
        **dataset["scope"],
        "business": "507f1f77bcf86cd799439099",
    }

    with pytest.raises(OfflineTrainingContractError, match="Business scope"):
        verify(dataset)


def test_frozen_dataset_contract_rejects_location_scope_mismatch():
    dataset = frozen_dataset()
    dataset["scope"] = {
        **dataset["scope"],
        "locations": ["507f1f77bcf86cd799439099"],
    }

    with pytest.raises(OfflineTrainingContractError, match="Location scope"):
        verify(dataset)


def test_frozen_dataset_contract_rejects_cross_business_scope():
    dataset = frozen_dataset()
    dataset["scope"] = {
        **dataset["scope"],
        "mode": "cross_business_deidentified",
    }

    with pytest.raises(OfflineTrainingContractError, match="single-Business"):
        verify(dataset)
