from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any, Mapping


MANIFEST_SCHEMA_VERSION = "salonai.model-artifact.v1"
_ALLOWED_LIFECYCLES = frozenset({"experiment", "candidate"})
_SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")


class ArtifactCompatibilityError(RuntimeError):
    """Raised when an AI artifact cannot enter a governed activation path."""


def _text(value: Any) -> str:
    return str(value or "").strip()


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _dataset_scope(dataset: Mapping[str, Any]) -> dict[str, Any]:
    scope = dict(dataset.get("scope") or {})
    business = _text(scope.get("business"))
    locations = sorted({_text(value) for value in scope.get("locations") or [] if _text(value)})

    if scope.get("mode") != "single_business" or not business:
        raise ArtifactCompatibilityError(
            "Model artifacts require trusted single_business dataset provenance."
        )
    if scope.get("deidentified") is not True:
        raise ArtifactCompatibilityError(
            "Model artifacts require an explicitly deidentified training dataset."
        )

    return {
        "mode": "single_business",
        "business": business,
        "locations": locations,
        "deidentified": True,
    }


def build_model_artifact_manifest(
    *,
    model_name: str,
    model_version: str,
    task: str,
    feature_version: str,
    dataset: Mapping[str, Any],
    algorithm: str,
    lifecycle: str,
    selected_threshold: float,
    artifact_path: str | Path,
    beats_rules_baseline: bool,
    created_at: str,
) -> dict[str, Any]:
    artifact = Path(artifact_path)
    lifecycle_value = _text(lifecycle)
    if lifecycle_value not in _ALLOWED_LIFECYCLES:
        raise ArtifactCompatibilityError(
            "Training may only emit experiment or candidate artifacts."
        )

    manifest = {
        "schemaVersion": MANIFEST_SCHEMA_VERSION,
        "model": {
            "name": _text(model_name),
            "version": _text(model_version),
            "task": _text(task),
            "featureVersion": _text(feature_version),
            "algorithm": _text(algorithm),
            "lifecycle": lifecycle_value,
            "selectedThreshold": float(selected_threshold),
        },
        "dataset": {
            "name": _text(dataset.get("name")),
            "version": _text(dataset.get("version")),
            "id": _text(dataset.get("_id")),
            "preprocessingHash": _text(dataset.get("preprocessingHash")),
            "sourceFingerprintHash": _text(dataset.get("sourceFingerprintHash")),
            "scope": _dataset_scope(dataset),
        },
        "artifact": {
            "file": artifact.name,
            "sha256": sha256_file(artifact),
        },
        "evaluation": {
            "beatsRulesBaseline": bool(beats_rules_baseline),
        },
        "createdAt": _text(created_at),
    }

    validate_model_artifact_manifest(
        manifest,
        expected_task=task,
        expected_feature_version=feature_version,
        expected_dataset_version=_text(dataset.get("version")),
        expected_business=_dataset_scope(dataset)["business"],
    )
    return manifest


def validate_model_artifact_manifest(
    manifest: Mapping[str, Any],
    *,
    expected_task: str,
    expected_feature_version: str,
    expected_dataset_version: str | None = None,
    expected_business: str | None = None,
) -> None:
    if manifest.get("schemaVersion") != MANIFEST_SCHEMA_VERSION:
        raise ArtifactCompatibilityError("Unsupported model artifact manifest schema.")

    model = dict(manifest.get("model") or {})
    dataset = dict(manifest.get("dataset") or {})
    artifact = dict(manifest.get("artifact") or {})
    scope = dict(dataset.get("scope") or {})

    if not _text(model.get("name")) or not _text(model.get("version")):
        raise ArtifactCompatibilityError("Model identity is incomplete.")
    if _text(model.get("task")) != _text(expected_task):
        raise ArtifactCompatibilityError("Model task is incompatible with the activation contract.")
    if _text(model.get("featureVersion")) != _text(expected_feature_version):
        raise ArtifactCompatibilityError("Model feature schema is incompatible with the activation contract.")
    if _text(model.get("lifecycle")) not in _ALLOWED_LIFECYCLES:
        raise ArtifactCompatibilityError("Model lifecycle is not eligible for governed evaluation.")

    if not _text(dataset.get("name")) or not _text(dataset.get("version")) or not _text(dataset.get("id")):
        raise ArtifactCompatibilityError("Training dataset provenance is incomplete.")
    if expected_dataset_version and _text(dataset.get("version")) != _text(expected_dataset_version):
        raise ArtifactCompatibilityError("Model dataset version is incompatible with the requested dataset.")

    if scope.get("mode") != "single_business" or scope.get("deidentified") is not True:
        raise ArtifactCompatibilityError("Model artifact dataset scope is not tenant-safe.")
    business = _text(scope.get("business"))
    if not business:
        raise ArtifactCompatibilityError("Model artifact is missing trusted Business provenance.")
    if expected_business and business != _text(expected_business):
        raise ArtifactCompatibilityError("Model artifact belongs to a different Business scope.")

    digest = _text(artifact.get("sha256"))
    if not _SHA256_PATTERN.fullmatch(digest):
        raise ArtifactCompatibilityError("Model artifact checksum is invalid or missing.")
    if not _text(artifact.get("file")):
        raise ArtifactCompatibilityError("Model artifact filename is missing.")


def write_model_artifact_manifest(
    manifest: Mapping[str, Any],
    destination: str | Path,
) -> Path:
    path = Path(destination)
    path.write_text(
        json.dumps(dict(manifest), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return path
