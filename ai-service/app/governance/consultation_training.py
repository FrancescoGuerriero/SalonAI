from __future__ import annotations

"""Governance contract for offline consultation model experiments."""

import json
import re
from pathlib import Path
from typing import Any, Mapping


AUTHORIZATION_SCHEMA_VERSION = "salonai.consultation-training-authorization.v1"
TASK = "consultation-booking-conversion"
FEATURE_VERSION = "consultation-booking-features.v1"
AUTHORIZED_USE = "offline-experiment"
ALLOWED_ALGORITHMS = frozenset({"logistic_regression"})
_ALLOWED_SOURCE_KINDS = frozenset(
    {"synthetic", "test-fixture", "approved-governed-export"}
)
_SHA256 = re.compile(r"^[0-9a-f]{64}$")


class ConsultationTrainingAuthorizationError(RuntimeError):
    """Raised when offline consultation training is not explicitly authorised."""


def _text(value: Any) -> str:
    return str(value or "").strip()


def _sha256(value: Any, field: str) -> str:
    digest = _text(value).lower()
    if not _SHA256.fullmatch(digest):
        raise ConsultationTrainingAuthorizationError(
            f"{field} must be a SHA-256 digest."
        )
    return digest


def load_consultation_training_authorization(path: str | Path) -> dict[str, Any]:
    source = Path(path)
    try:
        value = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ConsultationTrainingAuthorizationError(
            f"Unable to read consultation training authorization: {exc}"
        ) from exc
    if not isinstance(value, dict):
        raise ConsultationTrainingAuthorizationError(
            "Consultation training authorization must be a JSON object."
        )
    return value


def validate_consultation_training_authorization(
    authorization: Mapping[str, Any],
    snapshot: Mapping[str, Any],
    *,
    algorithm: str = "logistic_regression",
) -> dict[str, Any]:
    if authorization.get("schemaVersion") != AUTHORIZATION_SCHEMA_VERSION:
        raise ConsultationTrainingAuthorizationError(
            "Unsupported consultation training authorization schema."
        )
    if _text(authorization.get("task")) != TASK:
        raise ConsultationTrainingAuthorizationError(
            "Training authorization task is incompatible."
        )
    if _text(authorization.get("featureVersion")) != FEATURE_VERSION:
        raise ConsultationTrainingAuthorizationError(
            "Training authorization feature version is incompatible."
        )
    if _text(authorization.get("authorisedUse")) != AUTHORIZED_USE:
        raise ConsultationTrainingAuthorizationError(
            "Training authorization is not limited to offline experiments."
        )

    reference = _text(authorization.get("authorizationReference"))
    if not reference:
        raise ConsultationTrainingAuthorizationError(
            "Training authorization requires an opaque authorizationReference."
        )

    allowed_algorithms = {
        _text(value)
        for value in authorization.get("allowedAlgorithms") or []
        if _text(value)
    }
    requested_algorithm = _text(algorithm)
    if (
        requested_algorithm not in ALLOWED_ALGORITHMS
        or requested_algorithm not in allowed_algorithms
    ):
        raise ConsultationTrainingAuthorizationError(
            "Requested algorithm is not authorised for this offline experiment."
        )

    manifest = dict(snapshot.get("manifest") or {})
    snapshot_source = dict(manifest.get("source") or {})
    snapshot_ref = dict(authorization.get("snapshot") or {})
    snapshot_fingerprint = _sha256(
        manifest.get("fingerprint"),
        "Snapshot fingerprint",
    )

    if snapshot_ref.get("datasetVersion") != manifest.get("datasetVersion"):
        raise ConsultationTrainingAuthorizationError(
            "Training authorization references a different dataset version."
        )
    if _sha256(snapshot_ref.get("fingerprint"), "Authorised snapshot fingerprint") != snapshot_fingerprint:
        raise ConsultationTrainingAuthorizationError(
            "Training authorization references a different snapshot fingerprint."
        )
    if snapshot_ref.get("sourceKind") != snapshot_source.get("kind"):
        raise ConsultationTrainingAuthorizationError(
            "Training authorization references a different snapshot source kind."
        )
    if snapshot_source.get("kind") not in _ALLOWED_SOURCE_KINDS:
        raise ConsultationTrainingAuthorizationError(
            "Snapshot source kind is not eligible for governed offline experiments."
        )
    if snapshot_source.get("directProductionDatabaseAccess") is not False:
        raise ConsultationTrainingAuthorizationError(
            "Offline consultation training cannot use direct production database access."
        )

    dataset = dict(authorization.get("dataset") or {})
    dataset_id = _text(dataset.get("id"))
    dataset_name = _text(dataset.get("name"))
    dataset_version = _text(dataset.get("version"))
    if not dataset_id or not dataset_name or not dataset_version:
        raise ConsultationTrainingAuthorizationError(
            "Authorised dataset registry identity is incomplete."
        )
    if dataset_version != _text(manifest.get("datasetVersion")):
        raise ConsultationTrainingAuthorizationError(
            "Authorised dataset registry version does not match the snapshot."
        )

    schema_hash = _sha256(dataset.get("schemaHash"), "Dataset schemaHash")
    data_hash = _sha256(dataset.get("dataHash"), "Dataset dataHash")
    if data_hash != snapshot_fingerprint:
        raise ConsultationTrainingAuthorizationError(
            "Dataset dataHash must equal the exact governed snapshot fingerprint."
        )

    scope = dict(dataset.get("scope") or {})
    business = _text(scope.get("business"))
    if scope.get("mode") != "single_business" or not business:
        raise ConsultationTrainingAuthorizationError(
            "Consultation experiments require trusted single_business scope."
        )
    if scope.get("deidentified") is not True:
        raise ConsultationTrainingAuthorizationError(
            "Consultation experiments require deidentified dataset scope."
        )
    locations = sorted(
        {
            _text(value)
            for value in scope.get("locations") or []
            if _text(value)
        }
    )

    lineage = dict(dataset.get("lineage") or {})
    builder_version = _text(lineage.get("builderVersion"))
    source_collections = sorted(
        {
            _text(value)
            for value in lineage.get("sourceCollections") or []
            if _text(value)
        }
    )
    if not builder_version or not source_collections:
        raise ConsultationTrainingAuthorizationError(
            "Consultation experiment dataset lineage is incomplete."
        )

    return {
        "schemaVersion": AUTHORIZATION_SCHEMA_VERSION,
        "task": TASK,
        "featureVersion": FEATURE_VERSION,
        "authorisedUse": AUTHORIZED_USE,
        "authorizationReference": reference,
        "algorithm": requested_algorithm,
        "snapshot": {
            "datasetVersion": dataset_version,
            "fingerprint": snapshot_fingerprint,
            "sourceKind": snapshot_source.get("kind"),
        },
        "dataset": {
            "_id": dataset_id,
            "name": dataset_name,
            "version": dataset_version,
            "schemaHash": schema_hash,
            "dataHash": data_hash,
            "scope": {
                "mode": "single_business",
                "business": business,
                "locations": locations,
                "deidentified": True,
            },
            "lineage": {
                "builderVersion": builder_version,
                "gitCommit": _text(lineage.get("gitCommit")),
                "sourceCollections": source_collections,
            },
        },
    }
