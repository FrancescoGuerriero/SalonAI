from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.governance.model_artifact import (
    ArtifactCompatibilityError,
    MANIFEST_SCHEMA_VERSION,
    build_model_artifact_manifest,
    sha256_file,
    validate_model_artifact_manifest,
    write_model_artifact_manifest,
)


BUSINESS_ID = "64f000000000000000000001"
DATASET_ID = "64f000000000000000000101"


def governed_dataset() -> dict:
    return {
        "_id": DATASET_ID,
        "name": "salonai-no-show",
        "version": "2026-10-19.v1",
        "schemaHash": "a" * 64,
        "dataHash": "b" * 64,
        "scope": {
            "mode": "single_business",
            "business": BUSINESS_ID,
            "locations": [
                "64f000000000000000000012",
                "64f000000000000000000011",
                "64f000000000000000000011",
            ],
            "deidentified": True,
        },
        "lineage": {
            "builderVersion": "no-show-builder.v1",
            "gitCommit": "abc123",
            "sourceCollections": ["appointments", "customers", "appointments"],
        },
    }


def build_manifest(tmp_path: Path, **overrides) -> dict:
    artifact = tmp_path / "model.joblib"
    artifact.write_bytes(b"governed-model-artifact")
    values = {
        "model_name": "no_show_risk",
        "model_version": "2026-10-19.1",
        "task": "no_show_risk",
        "feature_version": "no-show-features.v1",
        "dataset": governed_dataset(),
        "algorithm": "logistic_regression",
        "lifecycle": "candidate",
        "selected_threshold": 0.42,
        "artifact_path": artifact,
        "beats_rules_baseline": True,
        "created_at": "2026-10-19T15:00:00Z",
    }
    values.update(overrides)
    return build_model_artifact_manifest(**values)


def validate(manifest: dict) -> None:
    validate_model_artifact_manifest(
        manifest,
        expected_task="no_show_risk",
        expected_feature_version="no-show-features.v1",
        expected_dataset_version="2026-10-19.v1",
        expected_business=BUSINESS_ID,
    )


def test_manifest_captures_tenant_safe_provenance_and_artifact_digest(tmp_path: Path):
    manifest = build_manifest(tmp_path)

    assert manifest["schemaVersion"] == MANIFEST_SCHEMA_VERSION
    assert manifest["model"]["lifecycle"] == "candidate"
    assert manifest["dataset"]["schemaHash"] == "a" * 64
    assert manifest["dataset"]["dataHash"] == "b" * 64
    assert manifest["dataset"]["scope"] == {
        "mode": "single_business",
        "business": BUSINESS_ID,
        "locations": [
            "64f000000000000000000011",
            "64f000000000000000000012",
        ],
        "deidentified": True,
    }
    assert manifest["dataset"]["lineage"]["sourceCollections"] == [
        "appointments",
        "customers",
    ]
    assert manifest["artifact"]["sha256"] == sha256_file(
        tmp_path / "model.joblib"
    )


def test_training_cannot_emit_active_artifact(tmp_path: Path):
    with pytest.raises(ArtifactCompatibilityError, match="experiment or candidate"):
        build_manifest(tmp_path, lifecycle="active")


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("task", "demand_forecast", "task is incompatible"),
        ("featureVersion", "no-show-features.v2", "feature schema is incompatible"),
        ("lifecycle", "active", "lifecycle is not eligible"),
    ],
)
def test_manifest_compatibility_rejects_model_contract_mismatch(
    tmp_path: Path,
    field: str,
    value: str,
    message: str,
):
    manifest = build_manifest(tmp_path)
    manifest["model"][field] = value

    with pytest.raises(ArtifactCompatibilityError, match=message):
        validate(manifest)


def test_manifest_compatibility_rejects_cross_business_artifact(tmp_path: Path):
    manifest = build_manifest(tmp_path)
    manifest["dataset"]["scope"]["business"] = "64f000000000000000000099"

    with pytest.raises(ArtifactCompatibilityError, match="different Business scope"):
        validate(manifest)


@pytest.mark.parametrize("field", ["schemaHash", "dataHash"])
def test_manifest_rejects_missing_or_invalid_dataset_hashes(
    tmp_path: Path,
    field: str,
):
    manifest = build_manifest(tmp_path)
    manifest["dataset"][field] = "not-a-sha256"

    with pytest.raises(ArtifactCompatibilityError, match=field):
        validate(manifest)


def test_manifest_rejects_incomplete_dataset_lineage(tmp_path: Path):
    manifest = build_manifest(tmp_path)
    manifest["dataset"]["lineage"]["sourceCollections"] = []

    with pytest.raises(ArtifactCompatibilityError, match="lineage is incomplete"):
        validate(manifest)


def test_manifest_rejects_invalid_or_missing_artifact_checksum(tmp_path: Path):
    manifest = build_manifest(tmp_path)
    manifest["artifact"]["sha256"] = "not-a-sha256"

    with pytest.raises(ArtifactCompatibilityError, match="checksum"):
        validate(manifest)


def test_manifest_round_trip_is_deterministic_json(tmp_path: Path):
    manifest = build_manifest(tmp_path)
    destination = write_model_artifact_manifest(
        manifest,
        tmp_path / "model.manifest.json",
    )

    assert json.loads(destination.read_text(encoding="utf-8")) == manifest
    text = destination.read_text(encoding="utf-8")
    assert text.endswith("\n")
    assert text.index('"artifact"') < text.index('"createdAt"')
