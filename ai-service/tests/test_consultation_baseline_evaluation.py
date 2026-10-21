from __future__ import annotations

from copy import deepcopy

import pytest

from evaluate_consultation_baseline import (
    ConsultationBaselineEvaluationError,
    consultation_snapshot_fingerprint,
    evaluate_booking_conversion_baseline,
)


MANIFEST_PRIVACY = {
    "pseudonymisedKeysOnly": True,
    "rawCustomerIdentifiersIncluded": False,
    "rawAppointmentIdentifiersIncluded": False,
    "rawConversationIdentifiersIncluded": False,
    "rawTranscriptIncluded": False,
    "freeTextNotesIncluded": False,
}
RECORD_PRIVACY = {
    "customerIdentifierIncluded": False,
    "appointmentIdentifierIncluded": False,
    "conversationIdentifierIncluded": False,
    "rawTranscriptIncluded": False,
    "freeTextNotesIncluded": False,
}


def learning_record(index: int, booking_converted: bool) -> dict:
    return {
        "schemaVersion": "consultation-learning-v1",
        "tenantKey": f"tenant-{index:02d}",
        "locationKey": "location-01",
        "consultationKey": f"consultation-{index:02d}",
        "consultationType": "hair-colour-chemical",
        "definitionVersion": "1",
        "features": {
            "hairCondition": "good",
            "desiredOutcome": "lighter",
        },
        "ruleEvidence": {
            "rulesetVersion": "hair-colour-rules.v1",
            "flagCodes": [],
            "bookingBlocked": False,
        },
        "aiEvidence": {
            "modelName": "",
            "modelVersion": "",
            "promptVersion": "consultation.v1",
            "featureVersion": "consultation-features.v1",
            "datasetVersion": "",
            "confidence": None,
        },
        "labels": {
            "reviewDecision": "approved",
            "correctionFields": [],
            "finalDecision": "approved",
            "bookingConverted": booking_converted,
            "servicePerformed": True,
            "customerAcceptedRecommendation": True,
        },
        "observedAt": "2026-10-20T12:00:00.000Z",
        "privacy": deepcopy(RECORD_PRIVACY),
    }


def governed_snapshot(*labels: bool) -> dict:
    records = [learning_record(index, value) for index, value in enumerate(labels, 1)]
    snapshot = {
        "manifest": {
            "snapshotSchemaVersion": "consultation-dataset-snapshot-v1",
            "recordSchemaVersion": "consultation-learning-v1",
            "datasetVersion": "consultation-2026-10-21.v1",
            "fingerprintAlgorithm": "sha256",
            "fingerprint": "",
            "createdAt": "2026-10-21T12:00:00.000Z",
            "source": {
                "kind": "test-fixture",
                "approvalReference": "",
                "directProductionDatabaseAccess": False,
            },
            "usePolicy": "evaluation-only",
            "trainingAuthorised": False,
            "statistics": {
                "inputSessions": len(records),
                "eligibleRecords": len(records),
                "excludedSessions": 0,
                "exclusionReasons": {},
            },
            "privacy": deepcopy(MANIFEST_PRIVACY),
        },
        "records": records,
    }
    snapshot["manifest"]["fingerprint"] = consultation_snapshot_fingerprint(snapshot)
    return snapshot


def test_majority_baseline_emits_deterministic_governed_evidence():
    snapshot = governed_snapshot(True, False, False)

    first = evaluate_booking_conversion_baseline(snapshot)
    second = evaluate_booking_conversion_baseline(snapshot)

    assert first == second
    assert first["task"] == "consultation-booking-conversion"
    assert first["dataset"]["fingerprint"] == snapshot["manifest"]["fingerprint"]
    assert first["classDistribution"] == {
        "bookingConverted": 1,
        "notBookingConverted": 2,
        "positiveRate": 0.333333,
        "bothClassesPresent": True,
    }
    assert first["baseline"] == {
        "name": "majority-class",
        "prediction": False,
        "accuracy": 0.666667,
        "balancedAccuracy": 0.5,
    }
    assert first["governance"] == {
        "offlineOnly": True,
        "trainingPerformed": False,
        "modelArtifactCreated": False,
        "productionEligible": False,
        "productionInferenceChanged": False,
    }
    assert len(first["evaluationFingerprint"]) == 64


def test_baseline_tie_is_deterministically_negative():
    evidence = evaluate_booking_conversion_baseline(governed_snapshot(True, False))

    assert evidence["baseline"]["prediction"] is False
    assert evidence["baseline"]["accuracy"] == 0.5


def test_snapshot_mutation_is_rejected_by_fingerprint_check():
    snapshot = governed_snapshot(False, False)
    snapshot["records"][0]["labels"]["bookingConverted"] = True

    with pytest.raises(
        ConsultationBaselineEvaluationError,
        match="fingerprint does not match",
    ):
        evaluate_booking_conversion_baseline(snapshot)


def test_training_authorisation_cannot_be_smuggled_into_evaluation_input():
    snapshot = governed_snapshot(True, False)
    snapshot["manifest"]["trainingAuthorised"] = True

    with pytest.raises(
        ConsultationBaselineEvaluationError,
        match="trainingAuthorised=false",
    ):
        evaluate_booking_conversion_baseline(snapshot)


def test_direct_identifier_privacy_regression_is_rejected():
    snapshot = governed_snapshot(True, False)
    snapshot["records"][0]["privacy"]["customerIdentifierIncluded"] = True
    snapshot["manifest"]["fingerprint"] = consultation_snapshot_fingerprint(snapshot)

    with pytest.raises(
        ConsultationBaselineEvaluationError,
        match="customerIdentifierIncluded must be false",
    ):
        evaluate_booking_conversion_baseline(snapshot)


def test_empty_snapshot_is_valid_governance_but_not_valid_evaluation():
    snapshot = governed_snapshot()

    with pytest.raises(
        ConsultationBaselineEvaluationError,
        match="At least one eligible consultation record",
    ):
        evaluate_booking_conversion_baseline(snapshot)
