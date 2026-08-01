from collections import Counter

from app.schemas.common import ServiceMetadata
from app.schemas.customer_segmentation import (
    CustomerSegmentationRequest,
    CustomerSegmentationResponse,
    CustomerSegmentFeatures,
    CustomerSegmentResult,
    SegmentCount,
    SegmentationThresholds,
)


SEGMENT_PRIORITY = [
    "inactive",
    "at_risk",
    "new",
    "loyal",
    "high_value",
    "discount_sensitive",
    "active",
]


ACTIONS = {
    "inactive": "Send a permission-aware reactivation message with a clear reason to return and a low-friction booking link.",
    "at_risk": "Contact the customer personally, confirm booking preferences and offer suitable appointment options before the relationship lapses.",
    "new": "Send a welcome follow-up, confirm satisfaction and recommend the most appropriate rebooking interval.",
    "loyal": "Recognise loyalty, protect preferred appointment access and introduce referral or membership benefits without unnecessary discounting.",
    "high_value": "Prioritise continuity, premium consultation and relevant retail or treatment recommendations based on recorded needs.",
    "discount_sensitive": "Use value-led bundles, transparent savings and targeted offers rather than broad permanent discounts.",
    "active": "Maintain regular service communication and prompt rebooking at the customer’s normal interval.",
}


LABELS = {
    "inactive": "Inactive",
    "at_risk": "At risk",
    "new": "New customer",
    "loyal": "Loyal",
    "high_value": "High value",
    "discount_sensitive": "Discount sensitive",
    "active": "Active",
}


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _ratio(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator


def _classify(
    feature: CustomerSegmentFeatures,
    thresholds: SegmentationThresholds,
) -> CustomerSegmentResult:
    segments: list[str] = []
    signals: list[str] = []

    completed = feature.completed_appointments
    total_history = (
        completed
        + feature.cancelled_appointments
        + feature.no_show_appointments
    )
    cancellation_rate = _ratio(
        feature.cancelled_appointments,
        total_history,
    )
    no_show_rate = _ratio(
        feature.no_show_appointments,
        total_history,
    )
    total_spend = feature.service_spend + feature.retail_spend

    is_new = (
        feature.account_age_days <= thresholds.new_customer_days
        and completed <= 1
    )
    is_loyal = (
        completed >= thresholds.loyal_completed_visits
        and feature.rebooking_rate >= thresholds.loyal_rebooking_rate
        and no_show_rate < 0.20
    )
    is_high_value = (
        total_spend >= thresholds.high_value_spend
        or (
            completed >= 3
            and feature.average_service_spend
            >= thresholds.high_value_average_spend
        )
    )
    is_inactive = (
        feature.days_since_last_visit is not None
        and feature.days_since_last_visit >= thresholds.inactive_days
        and feature.upcoming_appointments == 0
    )
    is_discount_sensitive = (
        completed >= 2
        and feature.discount_usage_rate
        >= thresholds.discount_usage_rate
    )

    risk_points = 0.0
    if feature.days_since_last_visit is None and completed == 0:
        risk_points += 0.10
    elif (
        feature.days_since_last_visit is not None
        and feature.days_since_last_visit >= thresholds.at_risk_days
        and feature.upcoming_appointments == 0
    ):
        risk_points += 0.45

    if no_show_rate >= 0.25:
        risk_points += 0.22
    elif no_show_rate > 0:
        risk_points += 0.08

    if cancellation_rate >= 0.35:
        risk_points += 0.18
    elif cancellation_rate >= 0.20:
        risk_points += 0.08

    if completed >= 2 and feature.rebooking_rate < 0.25:
        risk_points += 0.14

    if feature.contact_attempts >= 2 and feature.marketing_engagement_rate < 0.15:
        risk_points += 0.12

    if feature.upcoming_appointments > 0:
        risk_points -= 0.25

    risk_score = _clamp(risk_points)
    is_at_risk = (
        not is_inactive
        and completed > 0
        and risk_score >= 0.40
    )

    if is_new:
        segments.append("new")
        signals.append(
            f"Account age is {feature.account_age_days} days with {completed} completed visit(s)."
        )
    if is_loyal:
        segments.append("loyal")
        signals.append(
            f"{completed} completed visits and a {feature.rebooking_rate * 100:.0f}% rebooking rate indicate repeat loyalty."
        )
    if is_high_value:
        segments.append("high_value")
        signals.append(
            f"Recorded service and retail value is £{total_spend:,.2f}."
        )
    if is_inactive:
        segments.append("inactive")
        signals.append(
            f"The last completed visit was {feature.days_since_last_visit} days ago and no future booking is recorded."
        )
    if is_discount_sensitive:
        segments.append("discount_sensitive")
        signals.append(
            f"Discounts were used on {feature.discount_usage_rate * 100:.0f}% of completed appointments."
        )
    if is_at_risk:
        segments.append("at_risk")
        signals.append(
            f"Retention risk is elevated by recency, booking behaviour or low engagement ({risk_score * 100:.0f}% risk score)."
        )

    if not segments:
        segments.append("active")
        signals.append("The available behaviour indicates an active customer relationship without a specialist segment trigger.")

    primary = next(
        key for key in SEGMENT_PRIORITY if key in segments
    )

    spend_component = _clamp(total_spend / max(1, thresholds.high_value_spend))
    frequency_component = _clamp(completed / max(1, thresholds.loyal_completed_visits))
    loyalty_component = _clamp(feature.rebooking_rate)
    retail_component = _clamp(feature.product_orders / 4)
    value_score = _clamp(
        spend_component * 0.45
        + frequency_component * 0.30
        + loyalty_component * 0.20
        + retail_component * 0.05
    )

    data_points = sum(
        [
            completed > 0,
            feature.days_since_last_visit is not None,
            total_spend > 0,
            feature.contact_attempts > 0,
            feature.account_age_days > 0,
        ]
    )
    confidence = _clamp(0.50 + data_points * 0.08)

    channel = (
        feature.preferred_channel
        if feature.has_marketing_consent
        and feature.preferred_channel not in {"", "none"}
        else "staff follow-up"
    )

    explanation = (
        f"Primary segment: {LABELS[primary]}. "
        + " ".join(signals[:3])
    )

    return CustomerSegmentResult(
        customer_ref=feature.customer_ref,
        primary_segment=primary,
        segments=segments,
        value_score=round(value_score, 3),
        risk_score=round(risk_score, 3),
        confidence=round(confidence, 3),
        signals=signals,
        explanation=explanation,
        recommended_action=ACTIONS[primary],
        recommended_channel=channel,
    )


def analyse_customer_segments(
    payload: CustomerSegmentationRequest,
    *,
    provider_mode: str = "mock",
) -> CustomerSegmentationResponse:
    results = [
        _classify(item, payload.thresholds)
        for item in payload.customers
    ]

    counts = Counter(
        segment
        for result in results
        for segment in result.segments
    )

    segment_counts = [
        SegmentCount(key=key, count=counts.get(key, 0))
        for key in SEGMENT_PRIORITY
    ]

    return CustomerSegmentationResponse(
        customers=results,
        segment_counts=segment_counts,
        thresholds=payload.thresholds,
        metadata=ServiceMetadata(
            provider_mode=provider_mode,
            model_name="salonai-explainable-segmentation-v1",
            rules_applied=[
                "recency-frequency-value",
                "rebooking-behaviour",
                "cancellation-and-no-show-risk",
                "discount-affinity",
                "marketing-engagement",
                "privacy-preserving-customer-reference",
            ],
        ),
    )
