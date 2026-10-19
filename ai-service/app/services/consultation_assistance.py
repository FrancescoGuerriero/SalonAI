from __future__ import annotations

from typing import Any

from app.schemas.consultation import (
    ConsultationAiProvenance,
    ConsultationAssistanceRequest,
    ConsultationAssistanceResponse,
    ConsultationAttentionFlag,
    ConsultationSafetyBoundary,
)


MODEL_NAME = "salonai-consultation-structured-baseline"
MODEL_VERSION = "1"
PROMPT_VERSION = "structured-foundation-v1"
FEATURE_VERSION = "hair-colour-consultation-features-v1"
DATASET_VERSION = "not-applicable-foundation-v1"

_REQUIRED_FEATURES = (
    "desiredOutcome",
    "currentColour",
    "hairCondition",
    "colourHistory",
    "bleachHistory",
    "sensitivities",
)

_ALLOWED_FEATURES = frozenset(
    {
        *_REQUIRED_FEATURES,
        "naturalColour",
        "previousTreatments",
        "hairLength",
        "hairDensity",
        "patchTestRequired",
        "referenceMediaAvailable",
    }
)

_NEGATIVE_HISTORY = frozenset(
    {"", "none", "no", "never", "n/a", "na", "not applicable", "false"}
)


def _text(value: Any, maximum_length: int = 500) -> str:
    return " ".join(str(value or "").strip().split())[:maximum_length]


def _normalise_value(key: str, value: Any) -> Any:
    if key in {"patchTestRequired", "referenceMediaAvailable"}:
        if isinstance(value, bool):
            return value
        normalised = _text(value, 40).lower()
        if normalised in {"true", "yes", "required", "present"}:
            return True
        if normalised in {"false", "no", "none", "not required", "absent"}:
            return False
        return None
    return _text(value)


def _meaningful_history(value: Any) -> bool:
    return _text(value).lower() not in _NEGATIVE_HISTORY


def _service_intent(desired_outcome: str) -> str:
    text = desired_outcome.lower()
    if any(term in text for term in ("lighter", "blonde", "lift", "bleach")):
        return "lightening_or_blonde_consultation"
    if any(term in text for term in ("grey", "gray", "coverage", "root")):
        return "coverage_or_root_colour_consultation"
    if any(term in text for term in ("balayage", "highlight", "ombre", "ombré")):
        return "dimensional_colour_consultation"
    if any(term in text for term in ("copper", "red", "brunette", "brown", "black", "colour", "color")):
        return "colour_change_consultation"
    return "hair_colour_consultation"


def _add_attention_flag(
    flags: list[ConsultationAttentionFlag],
    *,
    code: str,
    severity: str,
    label: str,
) -> None:
    if any(item.code == code for item in flags):
        return
    flags.append(
        ConsultationAttentionFlag(
            code=code,
            severity=severity,
            label=label,
        )
    )


def build_consultation_assistance(
    payload: ConsultationAssistanceRequest,
    *,
    provider_mode: str = "mock",
) -> ConsultationAssistanceResponse:
    """Return bounded assistive evidence for a Node-owned consultation.

    This foundation intentionally performs no canonical write, booking decision,
    medical diagnosis, or safety-rule override. Node/Express remains the source
    of truth for the deterministic assessment and every workflow transition.
    """

    extracted: dict[str, Any] = {}
    for key, value in payload.features.items():
        if key not in _ALLOWED_FEATURES:
            continue
        normalised = _normalise_value(key, value)
        if normalised not in ("", None):
            extracted[key] = normalised

    incomplete_fields = [
        key for key in _REQUIRED_FEATURES if not _text(extracted.get(key))
    ]

    # Node's deterministic assessment is authoritative. Preserve any fields it
    # already declared incomplete even if a Python normalisation would disagree.
    for field in payload.deterministic_assessment.missing_fields:
        if field not in incomplete_fields:
            incomplete_fields.append(field)

    flags: list[ConsultationAttentionFlag] = []
    for rule_flag in payload.deterministic_assessment.flags:
        _add_attention_flag(
            flags,
            code=rule_flag.code,
            severity=rule_flag.severity,
            label=rule_flag.label,
        )

    hair_condition = _text(extracted.get("hairCondition")).lower()
    if any(
        term in hair_condition
        for term in (
            "damaged",
            "breakage",
            "brittle",
            "fragile",
            "compromised",
            "overprocessed",
            "over-processed",
        )
    ):
        _add_attention_flag(
            flags,
            code="assistive-condition-attention",
            severity="attention",
            label="Reported hair condition should be assessed by a qualified professional before a chemical-service plan is confirmed.",
        )

    if _meaningful_history(extracted.get("bleachHistory")) or _meaningful_history(
        extracted.get("previousTreatments")
    ):
        _add_attention_flag(
            flags,
            code="assistive-chemical-history",
            severity="attention",
            label="Previous bleach or chemical treatment history should be considered during professional review.",
        )

    if _meaningful_history(extracted.get("sensitivities")):
        _add_attention_flag(
            flags,
            code="assistive-reported-sensitivity",
            severity="blocking",
            label="Reported sensitivity requires professional review and applicable salon safety procedures.",
        )

    deterministic_block = (
        payload.deterministic_assessment.booking_blocked
        or payload.constraints.deterministic_booking_block
    )
    blocking_attention = any(item.severity == "blocking" for item in flags)

    if incomplete_fields:
        next_action = "collect_more_information"
    elif deterministic_block or blocking_attention:
        next_action = "professional_review_required"
    else:
        next_action = "professional_review_required"

    desired_outcome = _text(extracted.get("desiredOutcome"))
    recommendation = {
        "nextAction": next_action,
        "serviceIntent": _service_intent(desired_outcome),
        "bookingReady": False,
        "inPersonConsultationRecommended": bool(
            deterministic_block
            or blocking_attention
            or any(item.severity == "attention" for item in flags)
        ),
        "advisoryOnly": True,
    }

    rationale: list[str] = []
    if incomplete_fields:
        rationale.append(
            "More structured consultation information is required before a reliable service plan can be reviewed."
        )
    if deterministic_block:
        rationale.append(
            "The authoritative Node safety assessment currently blocks booking progression."
        )
    if flags:
        rationale.append(
            "Reported condition, treatment history or sensitivity evidence requires professional attention."
        )
    if not rationale:
        rationale.append(
            "The structured answers are sufficiently complete for professional review, but the AI response remains advisory."
        )

    completeness = (
        len(_REQUIRED_FEATURES) - len([key for key in incomplete_fields if key in _REQUIRED_FEATURES])
    ) / len(_REQUIRED_FEATURES)
    confidence = 0.5 + (0.32 * completeness)
    if deterministic_block or blocking_attention:
        confidence = min(confidence, 0.72)
    if incomplete_fields:
        confidence = min(confidence, 0.64)

    return ConsultationAssistanceResponse(
        extractedFeatures=extracted,
        incompleteFields=sorted(set(incomplete_fields)),
        recommendation=recommendation,
        confidence=round(max(0.35, min(0.82, confidence)), 3),
        rationale=rationale,
        attentionFlags=flags,
        safetyBoundary=ConsultationSafetyBoundary(
            deterministicBookingBlock=deterministic_block,
        ),
        provenance=ConsultationAiProvenance(
            providerMode=provider_mode,
            modelName=MODEL_NAME,
            modelVersion=MODEL_VERSION,
            promptVersion=PROMPT_VERSION,
            featureVersion=FEATURE_VERSION,
            datasetVersion=DATASET_VERSION,
        ),
    )
