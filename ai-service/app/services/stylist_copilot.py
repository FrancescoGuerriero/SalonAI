from __future__ import annotations

from typing import Any

from app.schemas.stylist_copilot import (
    StylistCopilotEvidence,
    StylistCopilotRecommendation,
    StylistCopilotRequest,
    StylistCopilotResponse,
    StylistCopilotSafetyBoundary,
    StylistCopilotProvenance,
)

MODEL_NAME = "salonai-stylist-copilot-structured-baseline"
MODEL_VERSION = "1"
PROMPT_VERSION = "professional-decision-support-v1"
FEATURE_VERSION = "stylist-copilot-context-v1"

SENSITIVE_KEYS = {
    "allergy",
    "allergies",
    "sensitivity",
    "sensitivities",
    "medical",
    "medication",
    "pregnancy",
    "condition",
}


def _text(value: Any, maximum_length: int = 500) -> str:
    return " ".join(str(value or "").strip().split())[:maximum_length]


def _label(key: str) -> str:
    return key.replace("_", " ").replace("-", " ").strip().title()


def _is_sensitive(key: str) -> bool:
    normalised = key.lower().replace("_", "").replace("-", "")
    return any(term.replace("_", "") in normalised for term in SENSITIVE_KEYS)


def _allowed_context(payload: StylistCopilotRequest, source_name: str, values: dict[str, Any]) -> dict[str, Any]:
    consented = set(payload.consented_context_keys)
    output: dict[str, Any] = {}
    for key, value in values.items():
        if _is_sensitive(key) and key not in consented:
            continue
        text = _text(value)
        if text:
            output[key] = text
    return output


def _summary_lines(values: dict[str, Any], limit: int = 8) -> list[str]:
    lines: list[str] = []
    for key, value in values.items():
        if len(lines) >= limit:
            break
        lines.append(f"{_label(key)}: {_text(value, 240)}")
    return lines


def _history_item_label(item: dict[str, Any], fallback: str) -> str:
    for key in ("name", "serviceName", "productName", "title", "label"):
        value = _text(item.get(key), 160)
        if value:
            return value
    return fallback


def _date_text(item: dict[str, Any]) -> str:
    for key in ("date", "completedAt", "purchasedAt", "createdAt"):
        value = _text(item.get(key), 80)
        if value:
            return value
    return ""


def build_stylist_copilot(
    payload: StylistCopilotRequest,
    *,
    provider_mode: str = "mock",
) -> StylistCopilotResponse:
    """Build bounded professional decision support from canonical context.

    This baseline performs no canonical write, customer messaging, safety-rule
    override or medical diagnosis. It only organises supplied evidence and
    produces advisory prompts for a human stylist.
    """

    appointment = _allowed_context(payload, "appointment", payload.appointment)
    consultation = _allowed_context(payload, "consultation", payload.consultation)
    preferences = _allowed_context(payload, "preferences", payload.preferences)

    pre_appointment_brief = _summary_lines(appointment, 6)
    consultation_summary = _summary_lines(consultation, 8)

    history_summary: list[str] = []
    for item in payload.previous_services[:5]:
        label = _history_item_label(item, "Previous service")
        date = _date_text(item)
        history_summary.append(f"Service: {label}" + (f" — {date}" if date else ""))
    for item in payload.previous_products[:5]:
        label = _history_item_label(item, "Previous product")
        date = _date_text(item)
        history_summary.append(f"Product: {label}" + (f" — {date}" if date else ""))
    for item in payload.follow_up[:5]:
        label = _history_item_label(item, "Follow-up")
        date = _date_text(item)
        history_summary.append(f"Follow-up: {label}" + (f" — {date}" if date else ""))

    recommendations: list[StylistCopilotRecommendation] = []

    if consultation:
        evidence = [
            StylistCopilotEvidence(source="consultation", key=key, label=_label(key))
            for key in list(consultation.keys())[:4]
        ]
        recommendations.append(
            StylistCopilotRecommendation(
                category="consultation",
                title="Review consultation evidence before confirming the service plan",
                rationale="The latest consultation contains structured client context that should be reviewed by the stylist before a professional decision is made.",
                evidence=evidence,
            )
        )

    if payload.previous_services:
        item = payload.previous_services[0]
        label = _history_item_label(item, "the previous service")
        recommendations.append(
            StylistCopilotRecommendation(
                category="service",
                title=f"Compare today's plan with {label}",
                rationale="Previous service history can help the stylist assess continuity, changes in requested outcome and appropriate follow-up questions.",
                evidence=[
                    StylistCopilotEvidence(
                        source="previous-service",
                        key="latest",
                        label=label,
                    )
                ],
            )
        )

    if payload.previous_products:
        item = payload.previous_products[0]
        label = _history_item_label(item, "the previous product")
        recommendations.append(
            StylistCopilotRecommendation(
                category="product",
                title=f"Review prior product use: {label}",
                rationale="Prior product history is relevant context for a stylist-led product or aftercare discussion, but does not constitute an automatic recommendation.",
                evidence=[
                    StylistCopilotEvidence(
                        source="previous-product",
                        key="latest",
                        label=label,
                    )
                ],
            )
        )

    if preferences:
        evidence = [
            StylistCopilotEvidence(source="preferences", key=key, label=_label(key))
            for key in list(preferences.keys())[:4]
        ]
        recommendations.append(
            StylistCopilotRecommendation(
                category="aftercare",
                title="Tailor aftercare discussion to recorded preferences",
                rationale="Recorded preferences can help the stylist make the aftercare conversation more relevant while preserving professional judgement.",
                evidence=evidence,
            )
        )

    if payload.follow_up:
        label = _history_item_label(payload.follow_up[0], "previous follow-up")
        recommendations.append(
            StylistCopilotRecommendation(
                category="follow-up",
                title="Review outstanding or recent follow-up context",
                rationale="Follow-up history may indicate maintenance, satisfaction or rebooking context that should be discussed with the client rather than acted on automatically.",
                evidence=[
                    StylistCopilotEvidence(
                        source="follow-up",
                        key="latest",
                        label=label,
                    )
                ],
            )
        )

    attention_flags: list[str] = []
    sensitive_supplied = [
        key
        for source in (payload.appointment, payload.consultation, payload.preferences)
        for key in source
        if _is_sensitive(key)
    ]
    hidden_sensitive = [
        key for key in sensitive_supplied if key not in set(payload.consented_context_keys)
    ]
    if hidden_sensitive:
        attention_flags.append(
            "Sensitive context was withheld because it was not included in the consented context keys."
        )

    safety_terms = ("allerg", "sensitiv", "patchtest", "patch test", "reaction")
    consented_sensitive_values = " ".join(
        _text(value).lower()
        for source in (consultation, preferences)
        for key, value in source.items()
        if _is_sensitive(key)
    )
    if any(term in consented_sensitive_values for term in safety_terms):
        attention_flags.append(
            "Safety-relevant client context is present and requires professional review; AI output must not override salon safety procedures."
        )

    evidence_units = (
        len(appointment)
        + len(consultation)
        + len(preferences)
        + min(len(payload.previous_services), 5)
        + min(len(payload.previous_products), 5)
        + min(len(payload.follow_up), 5)
    )
    confidence = min(0.88, 0.45 + (0.025 * evidence_units))
    if not consultation:
        confidence = min(confidence, 0.62)
    if hidden_sensitive:
        confidence = min(confidence, 0.68)

    return StylistCopilotResponse(
        preAppointmentBrief=pre_appointment_brief,
        consultationSummary=consultation_summary,
        historySummary=history_summary[:12],
        recommendations=recommendations[:8],
        attentionFlags=attention_flags,
        confidence=round(max(0.4, confidence), 3),
        safetyBoundary=StylistCopilotSafetyBoundary(),
        provenance=StylistCopilotProvenance(
            providerMode=provider_mode,
            modelName=MODEL_NAME,
            modelVersion=MODEL_VERSION,
            promptVersion=PROMPT_VERSION,
            featureVersion=FEATURE_VERSION,
        ),
    )
