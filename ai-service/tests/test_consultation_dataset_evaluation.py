import copy

import pytest

from app.services.consultation_dataset_evaluation import (
    ConsultationDatasetError,
    consultation_dataset_fingerprint,
    evaluate_consultation_dataset_snapshot,
    validate_consultation_dataset_snapshot,
)


def synthetic_snapshot():
    snapshot = {
        "manifest": {
            "snapshotSchemaVersion": "consultation-dataset-snapshot-v1",
            "recordSchemaVersion": "consultation-learning-v1",
            "datasetVersion": "synthetic-eval-v1",
            "fingerprintAlgorithm": "sha256",
            "fingerprint": "",
            "createdAt": "2026-10-20T00:00:00.000Z",
            "source": {
                "kind": "synthetic",
                "approvalReference": "",
                "directProductionDatabaseAccess": False,
            },
            "usePolicy": "evaluation-only",
            "trainingAuthorised": False,
            "statistics": {
                "inputSessions": 1,
                "eligibleRecords": 1,
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
                "tenantKey": "tenant-hash",
                "locationKey": "location-hash",
                "consultationKey": "consultation-hash",
                "consultationType": "hair-colour-chemical",
                "definitionVersion": "1",
                "features": {
                    "currentColour": "medium brown",
                    "desiredOutcome": "copper",
                },
                "ruleEvidence": {
                    "rulesetVersion": "hair-colour-chemical-rules-v1",
                    "flagCodes": [],
                    "bookingBlocked": False,
                },
                "aiEvidence": {
                    "modelName": "salonai-consultation-structured-baseline",
                    "modelVersion": "1",
                    "promptVersion": "foundation-v1",
                    "featureVersion": "hair-colour-consultation-features-v1",
                    "datasetVersion": "not-applicable-foundation-v1",
                    "confidence": 0.72,
                },
                "labels": {
                    "reviewDecision": "approved",
                    "correctionFields": [],
                    "finalDecision": "closed",
                    "bookingConverted": True,
                    "servicePerformed": True,
                    "customerAcceptedRecommendation": True,
                },
                "observedAt": "2026-10-19T12:00:00.000Z",
                "privacy": {
                    "customerIdentifierIncluded": False,
                    "appointmentIdentifierIncluded": False,
                    "conversationIdentifierIncluded": False,
                    "rawTranscriptIncluded": False,
                    "freeTextNotesIncluded": False,
                },
            }
        ],
    }
    snapshot["manifest"]["fingerprint"] = consultation_dataset_fingerprint(snapshot)
    return snapshot


def test_offline_snapshot_validation_accepts_governed_synthetic_contract():
    snapshot = synthetic_snapshot()
    assert validate_consultation_dataset_snapshot(snapshot) is snapshot


def test_offline_evaluation_returns_evidence_without_training_or_promotion():
    result = evaluate_consultation_dataset_snapshot(synthetic_snapshot())

    assert result["evaluationSchemaVersion"] == "consultation-dataset-evaluation-v1"
    assert result["recordCount"] == 1
    assert result["trainingPerformed"] is False
    assert result["modelPromoted"] is False
    assert result["reviewDecisionCounts"] == {"approved": 1}
    assert result["coverage"]["aiProvenance"] == 1.0
    assert result["coverage"]["servicePerformedLabel"] == 1.0
    assert result["rates"]["bookingConverted"] == 1.0
    assert result["rates"]["humanCorrection"] == 0.0


def test_snapshot_tampering_fails_fingerprint_validation():
    snapshot = synthetic_snapshot()
    snapshot["records"][0]["labels"]["bookingConverted"] = False

    with pytest.raises(ConsultationDatasetError, match="fingerprint"):
        validate_consultation_dataset_snapshot(snapshot)


def test_snapshot_rejects_training_authorisation_and_direct_production_access():
    training_snapshot = synthetic_snapshot()
    training_snapshot["manifest"]["trainingAuthorised"] = True
    training_snapshot["manifest"]["fingerprint"] = consultation_dataset_fingerprint(
        training_snapshot
    )
    with pytest.raises(ConsultationDatasetError, match="must not authorise"):
        validate_consultation_dataset_snapshot(training_snapshot)

    direct_access = synthetic_snapshot()
    direct_access["manifest"]["source"]["directProductionDatabaseAccess"] = True
    direct_access["manifest"]["fingerprint"] = consultation_dataset_fingerprint(
        direct_access
    )
    with pytest.raises(ConsultationDatasetError, match="direct production"):
        validate_consultation_dataset_snapshot(direct_access)


def test_snapshot_rejects_raw_identifier_or_free_text_fields():
    snapshot = synthetic_snapshot()
    snapshot["records"][0]["customerId"] = "raw-customer-id"
    snapshot["manifest"]["fingerprint"] = consultation_dataset_fingerprint(snapshot)

    with pytest.raises(ConsultationDatasetError, match="forbidden"):
        validate_consultation_dataset_snapshot(snapshot)


def test_evaluation_handles_empty_governed_snapshot_without_dividing_by_zero():
    snapshot = synthetic_snapshot()
    snapshot["records"] = []
    snapshot["manifest"]["statistics"] = {
        "inputSessions": 0,
        "eligibleRecords": 0,
        "excludedSessions": 0,
        "exclusionReasons": {},
    }
    snapshot["manifest"]["fingerprint"] = consultation_dataset_fingerprint(snapshot)

    result = evaluate_consultation_dataset_snapshot(snapshot)
    assert result["recordCount"] == 0
    assert result["coverage"]["aiProvenance"] is None
    assert result["rates"]["bookingConverted"] is None
