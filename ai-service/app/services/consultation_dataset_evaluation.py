"""Offline validation/evaluation for governed consultation dataset snapshots.

This module intentionally has no database, network, model-training or model-promotion
integration. It only consumes an already-built snapshot document.
"""

from __future__ import annotations

from collections import Counter
from hashlib import sha256
import json
from typing import Any


SNAPSHOT_SCHEMA_VERSION = "consultation-dataset-snapshot-v1"
RECORD_SCHEMA_VERSION = "consultation-learning-v1"


class ConsultationDatasetError(ValueError):
    """Raised when a governed consultation dataset snapshot is invalid."""


def _stable_json(value: Any) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def _fingerprint_payload(snapshot: dict[str, Any]) -> dict[str, Any]:
    manifest = snapshot.get("manifest") or {}
    return {
        "snapshotSchemaVersion": manifest.get("snapshotSchemaVersion"),
        "recordSchemaVersion": manifest.get("recordSchemaVersion"),
        "datasetVersion": manifest.get("datasetVersion"),
        "source": manifest.get("source"),
        "usePolicy": manifest.get("usePolicy"),
        "records": snapshot.get("records"),
    }


def consultation_dataset_fingerprint(snapshot: dict[str, Any]) -> str:
    """Recompute the cross-service SHA-256 dataset fingerprint."""

    payload = _fingerprint_payload(snapshot)
    return sha256(_stable_json(payload).encode("utf-8")).hexdigest()


def validate_consultation_dataset_snapshot(
    snapshot: dict[str, Any],
) -> dict[str, Any]:
    """Validate the governed snapshot boundary before offline evaluation."""

    if not isinstance(snapshot, dict):
        raise ConsultationDatasetError("snapshot must be an object")

    manifest = snapshot.get("manifest")
    records = snapshot.get("records")
    if not isinstance(manifest, dict) or not isinstance(records, list):
        raise ConsultationDatasetError("snapshot manifest and records are required")

    if manifest.get("snapshotSchemaVersion") != SNAPSHOT_SCHEMA_VERSION:
        raise ConsultationDatasetError("unsupported snapshot schema version")
    if manifest.get("recordSchemaVersion") != RECORD_SCHEMA_VERSION:
        raise ConsultationDatasetError("unsupported record schema version")
    if manifest.get("fingerprintAlgorithm") != "sha256":
        raise ConsultationDatasetError("unsupported fingerprint algorithm")
    if manifest.get("trainingAuthorised") is not False:
        raise ConsultationDatasetError("snapshot must not authorise model training")

    source = manifest.get("source") or {}
    if source.get("directProductionDatabaseAccess") is not False:
        raise ConsultationDatasetError(
            "snapshot must prove that direct production database access was not used"
        )

    privacy = manifest.get("privacy") or {}
    required_false = (
        "rawCustomerIdentifiersIncluded",
        "rawAppointmentIdentifiersIncluded",
        "rawConversationIdentifiersIncluded",
        "rawTranscriptIncluded",
        "freeTextNotesIncluded",
    )
    if privacy.get("pseudonymisedKeysOnly") is not True:
        raise ConsultationDatasetError("snapshot must use pseudonymised keys")
    if any(privacy.get(field) is not False for field in required_false):
        raise ConsultationDatasetError("snapshot privacy boundary is not satisfied")

    expected = consultation_dataset_fingerprint(snapshot)
    if manifest.get("fingerprint") != expected:
        raise ConsultationDatasetError("snapshot fingerprint does not match payload")

    forbidden_record_fields = {
        "customer",
        "customerId",
        "appointment",
        "appointmentId",
        "conversation",
        "conversationId",
        "rawTranscript",
        "notes",
    }
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            raise ConsultationDatasetError(f"records[{index}] must be an object")
        if record.get("schemaVersion") != RECORD_SCHEMA_VERSION:
            raise ConsultationDatasetError(
                f"records[{index}] has an unsupported schema version"
            )
        exposed = forbidden_record_fields.intersection(record)
        if exposed:
            raise ConsultationDatasetError(
                f"records[{index}] exposes forbidden identifiers or free text"
            )
        record_privacy = record.get("privacy") or {}
        if any(value is not False for value in record_privacy.values()):
            raise ConsultationDatasetError(
                f"records[{index}] violates the learning-record privacy contract"
            )

    return snapshot


def evaluate_consultation_dataset_snapshot(
    snapshot: dict[str, Any],
) -> dict[str, Any]:
    """Produce offline dataset evidence without training or invoking a model."""

    validate_consultation_dataset_snapshot(snapshot)
    records = snapshot["records"]
    count = len(records)

    review_decisions = Counter()
    model_provenance = 0
    booking_converted = 0
    service_performed_known = 0
    recommendation_acceptance_known = 0
    corrected_records = 0
    deterministic_booking_blocks = 0

    for record in records:
        labels = record.get("labels") or {}
        ai_evidence = record.get("aiEvidence") or {}
        rule_evidence = record.get("ruleEvidence") or {}

        review_decisions[str(labels.get("reviewDecision") or "unknown")] += 1
        if ai_evidence.get("modelName") and ai_evidence.get("modelVersion"):
            model_provenance += 1
        if labels.get("bookingConverted") is True:
            booking_converted += 1
        if labels.get("servicePerformed") is not None:
            service_performed_known += 1
        if labels.get("customerAcceptedRecommendation") is not None:
            recommendation_acceptance_known += 1
        if labels.get("correctionFields"):
            corrected_records += 1
        if rule_evidence.get("bookingBlocked") is True:
            deterministic_booking_blocks += 1

    def rate(numerator: int) -> float | None:
        if count == 0:
            return None
        return round(numerator / count, 6)

    manifest = snapshot["manifest"]
    return {
        "evaluationSchemaVersion": "consultation-dataset-evaluation-v1",
        "datasetVersion": manifest.get("datasetVersion"),
        "datasetFingerprint": manifest.get("fingerprint"),
        "usePolicy": manifest.get("usePolicy"),
        "trainingPerformed": False,
        "modelPromoted": False,
        "recordCount": count,
        "reviewDecisionCounts": dict(sorted(review_decisions.items())),
        "coverage": {
            "aiProvenance": rate(model_provenance),
            "servicePerformedLabel": rate(service_performed_known),
            "recommendationAcceptanceLabel": rate(recommendation_acceptance_known),
        },
        "rates": {
            "bookingConverted": rate(booking_converted),
            "humanCorrection": rate(corrected_records),
            "deterministicBookingBlocked": rate(deterministic_booking_blocks),
        },
    }
