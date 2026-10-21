from __future__ import annotations

"""Offline deterministic baseline evaluation for governed consultation snapshots.

This module intentionally performs no model training, database access, artifact
promotion or production inference activation. It verifies the immutable
consultation dataset-snapshot contract and records a simple majority-class
booking-conversion baseline that later ML experiments must beat.
"""

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


SNAPSHOT_SCHEMA_VERSION = "consultation-dataset-snapshot-v1"
RECORD_SCHEMA_VERSION = "consultation-learning-v1"
EVALUATION_SCHEMA_VERSION = "consultation-baseline-evaluation-v1"
TASK = "consultation-booking-conversion"

ALLOWED_SOURCE_KINDS = {
    "synthetic",
    "test-fixture",
    "approved-governed-export",
}
ALLOWED_USE_POLICIES = {
    "evaluation-only",
    "research-development",
}
MANIFEST_PRIVACY_FALSE_FIELDS = (
    "rawCustomerIdentifiersIncluded",
    "rawAppointmentIdentifiersIncluded",
    "rawConversationIdentifiersIncluded",
    "rawTranscriptIncluded",
    "freeTextNotesIncluded",
)
RECORD_PRIVACY_FALSE_FIELDS = (
    "customerIdentifierIncluded",
    "appointmentIdentifierIncluded",
    "conversationIdentifierIncluded",
    "rawTranscriptIncluded",
    "freeTextNotesIncluded",
)


class ConsultationBaselineEvaluationError(ValueError):
    """Raised when a consultation snapshot cannot be evaluated safely."""


def stable_json(value: Any) -> str:
    """Match the governed JS snapshot's recursively sorted JSON representation."""

    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def sha256_json(value: Any) -> str:
    return hashlib.sha256(stable_json(value).encode("utf-8")).hexdigest()


def consultation_snapshot_fingerprint(snapshot: dict[str, Any]) -> str:
    manifest = snapshot.get("manifest")
    records = snapshot.get("records")
    if not isinstance(manifest, dict) or not isinstance(records, list):
        raise ConsultationBaselineEvaluationError(
            "Snapshot must contain a manifest object and records array."
        )

    payload = {
        "snapshotSchemaVersion": manifest.get("snapshotSchemaVersion"),
        "recordSchemaVersion": manifest.get("recordSchemaVersion"),
        "datasetVersion": manifest.get("datasetVersion"),
        "source": manifest.get("source"),
        "usePolicy": manifest.get("usePolicy"),
        "records": records,
    }
    return sha256_json(payload)


def _require_false_fields(
    value: Any,
    fields: tuple[str, ...],
    *,
    context: str,
) -> None:
    if not isinstance(value, dict):
        raise ConsultationBaselineEvaluationError(f"{context} privacy contract is missing.")
    for field in fields:
        if value.get(field) is not False:
            raise ConsultationBaselineEvaluationError(
                f"{context} privacy field {field} must be false."
            )


def validate_consultation_snapshot(snapshot: dict[str, Any]) -> None:
    if not isinstance(snapshot, dict):
        raise ConsultationBaselineEvaluationError("Snapshot must be a JSON object.")

    manifest = snapshot.get("manifest")
    records = snapshot.get("records")
    if not isinstance(manifest, dict) or not isinstance(records, list):
        raise ConsultationBaselineEvaluationError(
            "Snapshot must contain a manifest object and records array."
        )

    if manifest.get("snapshotSchemaVersion") != SNAPSHOT_SCHEMA_VERSION:
        raise ConsultationBaselineEvaluationError("Snapshot schema version is incompatible.")
    if manifest.get("recordSchemaVersion") != RECORD_SCHEMA_VERSION:
        raise ConsultationBaselineEvaluationError("Record schema version is incompatible.")
    if manifest.get("fingerprintAlgorithm") != "sha256":
        raise ConsultationBaselineEvaluationError("Snapshot fingerprint must use sha256.")

    dataset_version = manifest.get("datasetVersion")
    if not isinstance(dataset_version, str) or not dataset_version.strip():
        raise ConsultationBaselineEvaluationError("Snapshot datasetVersion is required.")

    # Snapshot creation deliberately never grants training authority. This
    # evaluator keeps that boundary intact and produces evidence only.
    if manifest.get("trainingAuthorised") is not False:
        raise ConsultationBaselineEvaluationError(
            "Baseline evaluation accepts only snapshots with trainingAuthorised=false."
        )

    source = manifest.get("source")
    if not isinstance(source, dict) or source.get("kind") not in ALLOWED_SOURCE_KINDS:
        raise ConsultationBaselineEvaluationError("Snapshot source kind is not governed.")
    if source.get("directProductionDatabaseAccess") is not False:
        raise ConsultationBaselineEvaluationError(
            "Snapshot must prove directProductionDatabaseAccess=false."
        )
    if (
        source.get("kind") == "approved-governed-export"
        and not str(source.get("approvalReference") or "").strip()
    ):
        raise ConsultationBaselineEvaluationError(
            "Approved governed exports require an approvalReference."
        )

    if manifest.get("usePolicy") not in ALLOWED_USE_POLICIES:
        raise ConsultationBaselineEvaluationError("Snapshot usePolicy is not supported.")

    manifest_privacy = manifest.get("privacy")
    if not isinstance(manifest_privacy, dict) or manifest_privacy.get(
        "pseudonymisedKeysOnly"
    ) is not True:
        raise ConsultationBaselineEvaluationError(
            "Snapshot must use pseudonymised keys only."
        )
    _require_false_fields(
        manifest_privacy,
        MANIFEST_PRIVACY_FALSE_FIELDS,
        context="Manifest",
    )

    for index, record in enumerate(records):
        if not isinstance(record, dict):
            raise ConsultationBaselineEvaluationError(f"Record {index} must be an object.")
        if record.get("schemaVersion") != RECORD_SCHEMA_VERSION:
            raise ConsultationBaselineEvaluationError(
                f"Record {index} schema version is incompatible."
            )
        _require_false_fields(
            record.get("privacy"),
            RECORD_PRIVACY_FALSE_FIELDS,
            context=f"Record {index}",
        )
        labels = record.get("labels")
        if not isinstance(labels, dict) or not isinstance(
            labels.get("bookingConverted"), bool
        ):
            raise ConsultationBaselineEvaluationError(
                f"Record {index} must contain a boolean labels.bookingConverted value."
            )

    statistics = manifest.get("statistics")
    if not isinstance(statistics, dict):
        raise ConsultationBaselineEvaluationError("Snapshot statistics are missing.")
    if statistics.get("eligibleRecords") != len(records):
        raise ConsultationBaselineEvaluationError(
            "Snapshot eligibleRecords does not match the records array."
        )

    expected_fingerprint = consultation_snapshot_fingerprint(snapshot)
    if manifest.get("fingerprint") != expected_fingerprint:
        raise ConsultationBaselineEvaluationError(
            "Snapshot fingerprint does not match its governed payload."
        )


def evaluate_booking_conversion_baseline(
    snapshot: dict[str, Any],
) -> dict[str, Any]:
    validate_consultation_snapshot(snapshot)
    manifest = snapshot["manifest"]
    records = snapshot["records"]

    if not records:
        raise ConsultationBaselineEvaluationError(
            "At least one eligible consultation record is required for evaluation."
        )

    positives = sum(1 for record in records if record["labels"]["bookingConverted"])
    negatives = len(records) - positives
    # Ties resolve to false so the baseline remains deterministic.
    prediction = positives > negatives
    correct = positives if prediction else negatives
    accuracy = correct / len(records)

    if positives and negatives:
        sensitivity = 1.0 if prediction else 0.0
        specificity = 0.0 if prediction else 1.0
        balanced_accuracy: float | None = (sensitivity + specificity) / 2
    else:
        balanced_accuracy = None

    evidence: dict[str, Any] = {
        "schemaVersion": EVALUATION_SCHEMA_VERSION,
        "task": TASK,
        "dataset": {
            "version": manifest["datasetVersion"],
            "fingerprint": manifest["fingerprint"],
            "sourceKind": manifest["source"]["kind"],
            "usePolicy": manifest["usePolicy"],
            "recordCount": len(records),
        },
        "classDistribution": {
            "bookingConverted": positives,
            "notBookingConverted": negatives,
            "positiveRate": round(positives / len(records), 6),
            "bothClassesPresent": bool(positives and negatives),
        },
        "baseline": {
            "name": "majority-class",
            "prediction": prediction,
            "accuracy": round(accuracy, 6),
            "balancedAccuracy": (
                round(balanced_accuracy, 6)
                if balanced_accuracy is not None
                else None
            ),
        },
        "governance": {
            "offlineOnly": True,
            "trainingPerformed": False,
            "modelArtifactCreated": False,
            "productionEligible": False,
            "productionInferenceChanged": False,
        },
    }
    evidence["evaluationFingerprintAlgorithm"] = "sha256"
    evidence["evaluationFingerprint"] = sha256_json(evidence)
    return evidence


def load_snapshot(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ConsultationBaselineEvaluationError(
            f"Unable to read consultation snapshot: {exc}"
        ) from exc
    if not isinstance(value, dict):
        raise ConsultationBaselineEvaluationError("Snapshot root must be a JSON object.")
    return value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate a governed consultation snapshot against the deterministic majority-class baseline."
    )
    parser.add_argument("snapshot", type=Path, help="Path to a governed snapshot JSON file.")
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional path for deterministic evaluation evidence JSON.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    evidence = evaluate_booking_conversion_baseline(load_snapshot(args.snapshot))
    rendered = json.dumps(evidence, indent=2, sort_keys=True, ensure_ascii=False) + "\n"

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
        print(args.output)
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
