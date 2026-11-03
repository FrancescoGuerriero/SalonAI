from datetime import datetime, timezone

import pytest

from app.governance.training_manifest_policy import (
    TrainingManifestPolicyError,
    evaluate_training_manifest,
)
from app.schemas.ai_core import TrainingDatasetManifest


def manifest(**overrides) -> TrainingDatasetManifest:
    values = {
        "dataset_key": "appointments-history",
        "business_id": "business-1",
        "location_id": "location-1",
        "approved_purpose": "no_show_prediction",
        "feature_definition_version": "no-show-v1",
        "row_count": 120,
        "sha256_fingerprint": "a" * 64,
        "generated_at": datetime(2026, 10, 27, tzinfo=timezone.utc),
        "provenance_source_ids": ["appointments:2026-01-01:2026-10-01"],
        "contains_direct_identifiers": False,
        "contains_credentials": False,
    }
    values.update(overrides)
    return TrainingDatasetManifest(**values)


def test_no_show_manifest_is_accepted_only_for_registered_offline_track():
    decision = evaluate_training_manifest(
        manifest(),
        track_key="no-show-risk",
    )

    assert decision.accepted is True
    assert decision.track_key == "no-show-risk"
    assert decision.dataset_key == "appointments-history"
    assert decision.offline_training_only is True
    assert decision.production_promotion_authorised is False


def test_manifest_rejects_dataset_not_approved_for_track():
    with pytest.raises(TrainingManifestPolicyError, match="not approved"):
        evaluate_training_manifest(
            manifest(
                dataset_key="commerce-history",
                approved_purpose="sales_forecasting",
            ),
            track_key="no-show-risk",
        )


def test_manifest_rejects_direct_identifiers():
    with pytest.raises(TrainingManifestPolicyError, match="direct identifiers"):
        evaluate_training_manifest(
            manifest(contains_direct_identifiers=True),
            track_key="no-show-risk",
        )


def test_manifest_rejects_credentials():
    with pytest.raises(TrainingManifestPolicyError, match="credentials"):
        evaluate_training_manifest(
            manifest(contains_credentials=True),
            track_key="no-show-risk",
        )


def test_manifest_rejects_unapproved_purpose():
    with pytest.raises(TrainingManifestPolicyError, match="not approved"):
        evaluate_training_manifest(
            manifest(approved_purpose="retention_modelling"),
            track_key="no-show-risk",
        )


def test_manifest_rejects_unknown_model_track():
    with pytest.raises(TrainingManifestPolicyError, match="not registered"):
        evaluate_training_manifest(
            manifest(),
            track_key="unknown-track",
        )


def test_clinical_dataset_remains_ineligible_for_training():
    with pytest.raises(TrainingManifestPolicyError, match="restricted"):
        evaluate_training_manifest(
            manifest(
                dataset_key="clinical-records",
                approved_purpose="no_show_prediction",
            ),
            track_key="no-show-risk",
        )
