from __future__ import annotations

"""Governed offline experiment trainer for consultation booking conversion.

The trainer accepts only immutable snapshot files plus separately supplied
baseline evidence and explicit training authorization. It has no database,
registry or production-inference write path and can emit only an experiment.
"""

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline

from app.governance.consultation_training import (
    FEATURE_VERSION,
    TASK,
    load_consultation_training_authorization,
    validate_consultation_training_authorization,
)
from app.governance.model_artifact import (
    build_model_artifact_manifest,
    write_model_artifact_manifest,
)
from evaluate_consultation_baseline import (
    evaluate_booking_conversion_baseline,
    load_snapshot,
    sha256_json,
    stable_json,
)


MODEL_NAME = "consultation_booking_conversion"
ALGORITHM = "logistic_regression"


class ConsultationExperimentError(RuntimeError):
    """Raised when a governed consultation experiment cannot proceed."""


def _load_json_object(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ConsultationExperimentError(f"Unable to read {label}: {exc}") from exc
    if not isinstance(value, dict):
        raise ConsultationExperimentError(f"{label} must be a JSON object.")
    return value


def _add_feature(row: dict[str, Any], key: str, value: Any) -> None:
    if value is None:
        return
    if isinstance(value, (str, int, float, bool)):
        row[key] = value
        return
    if isinstance(value, list):
        for item in value:
            if isinstance(item, (str, int, float, bool)):
                row[f"{key}::{item}"] = True
            else:
                row[f"{key}::{stable_json(item)}"] = True
        return
    row[key] = stable_json(value)


def consultation_feature_row(record: dict[str, Any]) -> dict[str, Any]:
    """Extract only governed structured features; never transcript/free text."""

    row: dict[str, Any] = {
        "consultationType": str(record.get("consultationType") or ""),
        "definitionVersion": str(record.get("definitionVersion") or ""),
    }
    for key, value in sorted(dict(record.get("features") or {}).items()):
        _add_feature(row, f"feature::{key}", value)

    rule_evidence = dict(record.get("ruleEvidence") or {})
    row["rule::bookingBlocked"] = bool(rule_evidence.get("bookingBlocked"))
    row["rule::rulesetVersion"] = str(rule_evidence.get("rulesetVersion") or "")
    for flag in sorted(str(value) for value in rule_evidence.get("flagCodes") or []):
        if flag:
            row[f"rule::flag::{flag}"] = True
    return row


def _verify_baseline_evidence(
    snapshot: dict[str, Any],
    evidence: dict[str, Any],
) -> dict[str, Any]:
    expected = evaluate_booking_conversion_baseline(snapshot)
    if evidence != expected:
        raise ConsultationExperimentError(
            "Baseline evidence does not exactly match the governed snapshot."
        )
    return expected


def run_experiment(
    *,
    snapshot: dict[str, Any],
    baseline_evidence: dict[str, Any],
    authorization: dict[str, Any],
    artifact_dir: Path,
    model_version: str,
) -> dict[str, Path]:
    baseline = _verify_baseline_evidence(snapshot, baseline_evidence)
    authorised = validate_consultation_training_authorization(
        authorization,
        snapshot,
        algorithm=ALGORITHM,
    )

    version = str(model_version or "").strip()
    if not version:
        raise ConsultationExperimentError("model_version is required.")

    records = list(snapshot["records"])
    labels = [int(record["labels"]["bookingConverted"]) for record in records]
    class_counts = Counter(labels)
    if set(class_counts) != {0, 1}:
        raise ConsultationExperimentError(
            "Consultation experiment requires both booking-conversion classes."
        )
    minority_count = min(class_counts.values())
    if minority_count < 2:
        raise ConsultationExperimentError(
            "Consultation experiment requires at least two records in each class."
        )

    rows = [consultation_feature_row(record) for record in records]
    folds = min(5, minority_count)
    pipeline = Pipeline(
        [
            ("features", DictVectorizer(sparse=True)),
            (
                "model",
                LogisticRegression(
                    max_iter=1000,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )
    cross_validation = StratifiedKFold(
        n_splits=folds,
        shuffle=True,
        random_state=42,
    )
    predictions = cross_val_predict(
        pipeline,
        rows,
        labels,
        cv=cross_validation,
        method="predict",
    )

    accuracy = float(accuracy_score(labels, predictions))
    balanced_accuracy = float(balanced_accuracy_score(labels, predictions))
    precision = float(precision_score(labels, predictions, zero_division=0))
    recall = float(recall_score(labels, predictions, zero_division=0))
    f1 = float(f1_score(labels, predictions, zero_division=0))

    baseline_accuracy = float(baseline["baseline"]["accuracy"])
    baseline_balanced = baseline["baseline"].get("balancedAccuracy")
    if baseline_balanced is None:
        raise ConsultationExperimentError(
            "Baseline evidence must contain both classes before model training."
        )
    baseline_balanced = float(baseline_balanced)
    beats_baseline = (
        accuracy > baseline_accuracy and balanced_accuracy > baseline_balanced
    )

    destination = artifact_dir / snapshot["manifest"]["datasetVersion"] / version
    destination.mkdir(parents=True, exist_ok=True)
    artifact_path = destination / "model.joblib"
    metrics_path = destination / "metrics.json"
    manifest_path = destination / "model.manifest.json"

    pipeline.fit(rows, labels)
    joblib.dump(pipeline, artifact_path)

    metrics: dict[str, Any] = {
        "schemaVersion": "consultation-model-evaluation-v1",
        "task": TASK,
        "model": {
            "name": MODEL_NAME,
            "version": version,
            "algorithm": ALGORITHM,
            "featureVersion": FEATURE_VERSION,
            "lifecycle": "experiment",
        },
        "dataset": {
            "version": snapshot["manifest"]["datasetVersion"],
            "fingerprint": snapshot["manifest"]["fingerprint"],
            "recordCount": len(records),
            "classCounts": {
                "notBookingConverted": class_counts[0],
                "bookingConverted": class_counts[1],
            },
        },
        "crossValidation": {
            "strategy": "stratified-k-fold",
            "folds": folds,
            "randomState": 42,
            "accuracy": round(accuracy, 6),
            "balancedAccuracy": round(balanced_accuracy, 6),
            "precision": round(precision, 6),
            "recall": round(recall, 6),
            "f1": round(f1, 6),
        },
        "baseline": {
            "name": baseline["baseline"]["name"],
            "accuracy": baseline_accuracy,
            "balancedAccuracy": baseline_balanced,
            "evidenceFingerprint": baseline["evaluationFingerprint"],
            "beatsBaseline": beats_baseline,
        },
        "governance": {
            "authorizationSchemaVersion": authorised["schemaVersion"],
            "authorizationReference": authorised["authorizationReference"],
            "offlineOnly": True,
            "directProductionDatabaseAccess": False,
            "registryWritePerformed": False,
            "productionEligible": False,
            "productionInferenceChanged": False,
        },
    }
    metrics["evaluationFingerprintAlgorithm"] = "sha256"
    metrics["evaluationFingerprint"] = sha256_json(metrics)
    metrics_path.write_text(
        json.dumps(metrics, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    manifest = build_model_artifact_manifest(
        model_name=MODEL_NAME,
        model_version=version,
        task=TASK,
        feature_version=FEATURE_VERSION,
        dataset=authorised["dataset"],
        algorithm=ALGORITHM,
        lifecycle="experiment",
        selected_threshold=0.5,
        artifact_path=artifact_path,
        # The shared v1 field is retained for compatibility. This experiment
        # is compared with a majority-class baseline, not the no-show rules baseline.
        beats_rules_baseline=False,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    manifest["evaluation"].update(
        {
            "baselineName": baseline["baseline"]["name"],
            "beatsBaseline": beats_baseline,
            "baselineAccuracy": baseline_accuracy,
            "baselineBalancedAccuracy": baseline_balanced,
            "crossValidatedAccuracy": round(accuracy, 6),
            "crossValidatedBalancedAccuracy": round(balanced_accuracy, 6),
            "evidenceFingerprint": metrics["evaluationFingerprint"],
        }
    )
    manifest["trainingAuthorization"] = {
        "schemaVersion": authorised["schemaVersion"],
        "authorizationReference": authorised["authorizationReference"],
        "snapshotFingerprint": authorised["snapshot"]["fingerprint"],
    }
    write_model_artifact_manifest(manifest, manifest_path)

    return {
        "artifact": artifact_path,
        "metrics": metrics_path,
        "manifest": manifest_path,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train an offline governed consultation booking-conversion experiment."
    )
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("baseline_evidence", type=Path)
    parser.add_argument("authorization", type=Path)
    parser.add_argument("--artifact-dir", type=Path, default=Path("artifacts/consultation"))
    parser.add_argument("--model-version", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    outputs = run_experiment(
        snapshot=load_snapshot(args.snapshot),
        baseline_evidence=_load_json_object(args.baseline_evidence, "baseline evidence"),
        authorization=load_consultation_training_authorization(args.authorization),
        artifact_dir=args.artifact_dir,
        model_version=args.model_version,
    )
    print(json.dumps({key: str(value) for key, value in outputs.items()}, sort_keys=True))


if __name__ == "__main__":
    main()
