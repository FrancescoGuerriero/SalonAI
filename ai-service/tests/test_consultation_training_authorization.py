from __future__ import annotations

from copy import deepcopy

import pytest

from app.governance.consultation_training import (
    ConsultationTrainingAuthorizationError,
    validate_consultation_training_authorization,
)
from evaluate_consultation_baseline import consultation_snapshot_fingerprint


RECORD_PRIVACY = {
    "customerIdentifierIncluded": False,
    "appointmentIdentifierIncluded": False,
    "conversationIdentifierIncluded": False,
    "rawTranscriptIncluded": False,
    "freeTextNotesIncluded": False,
}


def snapshot() -> dict:
    value = {
        "manifest": {
            "snapshotSchemaVersion": "consultation-dataset-snapshot-v1",
            "recordSchemaVersion": "consultation-learning-v1",
            "datasetVersion": "consultation-2026-10-21.v1",
            "fingerprintAlgorithm": "sha256",
            "fingerprint": "",
            "source": {
                "kind": "approved-governed-export",
                "approvalReference": "approval-307",
                "directProductionDatabaseAccess": False,
            },
            "usePolicy": "research-development",
            "trainingAuthorised": False,
            "statistics": {
                "inputSessions": 2,
                "eligibleRecords": 2,
                "excludedSessions": 0,
                "exclusionReasons": {},
            },
            "privacy": {
                "pseudonymisedKeysOnly": True,
                "rawCustomerIdentifiersIncluded": False,
                "rawAppointmentIdentifiersIncluded": False,
                "rawConversationIdentifiersIncluded": False,
                "rawTranscriptIncluded": False,
                "freeTextNotesIncluded": False,
            },
        },
        "records": [
            {
                "schemaVersion": "consultation-learning-v1",
                "consultationKey": "a" * 64,
                "features": {"hairCondition": "good"},
                "labels": {"bookingConverted": True},
                "privacy": deepcopy(RECORD_PRIVACY),
            },
            {
                "schemaVersion": "consultation-learning-v1",
                "consultationKey": "b" * 64,
                "features": {"hairCondition": "damaged"},
                "labels": {"bookingConverted": False},
                "privacy": deepcopy(RECORD_PRIVACY),
            },
        ],
    }
    value["manifest"]["fingerprint"] = consultation_snapshot_fingerprint(value)
    return value


def authorization(governed_snapshot: dict) -> dict:
    fingerprint = governed_snapshot["manifest"]["fingerprint"]
    return {
        "schemaVersion": "salonai.consultation-training-authorization.v1",
        "task": "consultation-booking-conversion",
        "featureVersion": "consultation-booking-features.v1",
        "authorisedUse": "offline-experiment",
        "authorizationReference": "review-307-2026-10-21",
        "allowedAlgorithms": ["logistic_regression"],
        "snapshot": {
            "datasetVersion": governed_snapshot["manifest"]["datasetVersion"],
            "fingerprint": fingerprint,
            "sourceKind": governed_snapshot["manifest"]["source"]["kind"],
        },
        "dataset": {
            "id": "dataset-consultation-001",
            "name": "salonai-consultation-booking",
            "version": governed_snapshot["manifest"]["datasetVersion"],
            "schemaHash": "a" * 64,
            "dataHash": fingerprint,
            "scope": {
                "mode": "single_business",
                "business": "64f000000000000000000001",
                "locations": [
                    "64f000000000000000000012",
                    "64f000000000000000000011",
                    "64f000000000000000000011",
                ],
                "deidentified": True,
            },
            "lineage": {
                "builderVersion": "consultation-dataset-snapshot-v1",
                "gitCommit": "abc123",
                "sourceCollections": ["consultationsessions"],
            },
        },
    }


def test_authorization_binds_exact_snapshot_and_tenant_scope():
    governed_snapshot = snapshot()
    result = validate_consultation_training_authorization(
        authorization(governed_snapshot),
        governed_snapshot,
    )

    assert result["snapshot"]["fingerprint"] == governed_snapshot["manifest"]["fingerprint"]
    assert result["dataset"]["dataHash"] == governed_snapshot["manifest"]["fingerprint"]
    assert result["dataset"]["scope"] == {
        "mode": "single_business",
        "business": "64f000000000000000000001",
        "locations": [
            "64f000000000000000000011",
            "64f000000000000000000012",
        ],
        "deidentified": True,
    }


def test_authorization_cannot_be_reused_for_different_snapshot():
    governed_snapshot = snapshot()
    auth = authorization(governed_snapshot)
    auth["snapshot"]["fingerprint"] = "c" * 64

    with pytest.raises(
        ConsultationTrainingAuthorizationError,
        match="different snapshot fingerprint",
    ):
        validate_consultation_training_authorization(auth, governed_snapshot)


def test_authorization_rejects_direct_production_database_access():
    governed_snapshot = snapshot()
    auth = authorization(governed_snapshot)
    governed_snapshot["manifest"]["source"]["directProductionDatabaseAccess"] = True

    with pytest.raises(
        ConsultationTrainingAuthorizationError,
        match="direct production database access",
    ):
        validate_consultation_training_authorization(auth, governed_snapshot)


def test_dataset_data_hash_must_equal_governed_snapshot_fingerprint():
    governed_snapshot = snapshot()
    auth = authorization(governed_snapshot)
    auth["dataset"]["dataHash"] = "d" * 64

    with pytest.raises(
        ConsultationTrainingAuthorizationError,
        match="dataHash must equal",
    ):
        validate_consultation_training_authorization(auth, governed_snapshot)


def test_only_explicitly_allowed_algorithm_can_run():
    governed_snapshot = snapshot()
    auth = authorization(governed_snapshot)
    auth["allowedAlgorithms"] = []

    with pytest.raises(
        ConsultationTrainingAuthorizationError,
        match="algorithm is not authorised",
    ):
        validate_consultation_training_authorization(auth, governed_snapshot)
