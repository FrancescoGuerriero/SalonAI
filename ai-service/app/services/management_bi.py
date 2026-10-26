from __future__ import annotations

from app.governance.ai_registry import REGISTRY_VERSION
from app.schemas.management_bi import (
    ManagementBiAnalysisRequest,
    ManagementBiAnalysisResponse,
    ManagementBiObservation,
)

ANALYSIS_VERSION = "salonai-management-bi-statistical-v1"


def _observation(metric) -> ManagementBiObservation:
    current = float(metric.value)
    previous = float(metric.previous_value)
    absolute_change = current - previous

    if previous == 0:
        percent_change = None if current != 0 else 0.0
        direction = "new_baseline" if current != 0 else "flat"
    else:
        percent_change = (absolute_change / abs(previous)) * 100.0
        direction = "up" if absolute_change > 0 else "down" if absolute_change < 0 else "flat"

    material = bool(percent_change is not None and abs(percent_change) >= 8.0)
    if direction == "new_baseline":
        message = f"{metric.label} has a new non-zero baseline of {current:.2f} {metric.unit}."
    elif direction == "flat":
        message = f"{metric.label} is unchanged versus the previous period."
    else:
        change_text = f"{abs(percent_change):.1f}%" if percent_change is not None else "a new baseline"
        message = f"{metric.label} moved {direction} by {change_text} versus the previous period."

    return ManagementBiObservation(
        metric_key=metric.key,
        direction=direction,
        absolute_change=absolute_change,
        percent_change=percent_change,
        material=material,
        message=message,
    )


def analyse_management_bi(payload: ManagementBiAnalysisRequest) -> ManagementBiAnalysisResponse:
    observations = [_observation(metric) for metric in payload.evidence.metrics]
    return ManagementBiAnalysisResponse(
        registry_version=REGISTRY_VERSION,
        analysis_version=ANALYSIS_VERSION,
        business_id=payload.evidence.business_id,
        location_id=payload.evidence.location_id,
        evidence_id=payload.evidence.evidence_id,
        checksum=payload.evidence.checksum,
        observations=observations,
        message=(
            "Deterministic statistical analysis of canonical management BI evidence only. "
            "No operational database was queried, no model inference was executed, and no action is authorised."
        ),
    )
