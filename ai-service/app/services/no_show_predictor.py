from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.common import ServiceMetadata
from app.schemas.no_show_prediction import (
    AppointmentNoShowPrediction,
    AppointmentRiskObservation,
    NoShowPredictionRequest,
    NoShowPredictionResponse,
    NoShowPredictionSummary,
    NoShowRiskFactor,
)


MODEL_NAME = "salonai-no-show-risk-rules-v1"

RULES_APPLIED = [
    "customer-no-show-history",
    "customer-cancellation-history",
    "booking-lead-time",
    "new-customer-risk",
    "reminder-confirmation",
    "deposit-protection",
    "reschedule-frequency",
    "visit-recency",
    "appointment-time-pattern",
]


def _clamp(
    value: float,
    minimum: float = 0.0,
    maximum: float = 1.0,
) -> float:
    return max(
        minimum,
        min(
            maximum,
            value,
        ),
    )


def _factor(
    code: str,
    label: str,
    contribution: float,
) -> NoShowRiskFactor:
    return NoShowRiskFactor(
        code=code,
        label=label,
        contribution=round(
            contribution,
            4,
        ),
    )


def _score(
    item: AppointmentRiskObservation,
) -> tuple[
    float,
    list[NoShowRiskFactor],
]:
    score = 0.12

    factors: list[
        NoShowRiskFactor
    ] = []

    if (
        item.previous_bookings >
        0
    ):
        no_show_rate = (
            item.previous_no_shows /
            item.previous_bookings
        )

        contribution = min(
            0.55,
            no_show_rate * 0.75,
        )

        if contribution:
            score += contribution

            factors.append(
                _factor(
                    "history_no_show",
                    "Previous no-show history",
                    contribution,
                )
            )

        cancellation_rate = (
            item.previous_cancellations /
            item.previous_bookings
        )

        contribution = min(
            0.16,
            cancellation_rate * 0.24,
        )

        if contribution:
            score += contribution

            factors.append(
                _factor(
                    "history_cancellation",
                    "Previous cancellation history",
                    contribution,
                )
            )

    if item.is_new_customer:
        score += 0.10

        factors.append(
            _factor(
                "new_customer",
                "New customer",
                0.10,
            )
        )

    if (
        item.lead_time_days >=
        45
    ):
        score += 0.10

        factors.append(
            _factor(
                "long_lead_time",
                "Booked far in advance",
                0.10,
            )
        )
    elif (
        item.lead_time_days <=
        1
    ):
        score += 0.04

        factors.append(
            _factor(
                "short_lead_time",
                "Very short booking notice",
                0.04,
            )
        )

    if (
        item.reschedule_count >=
        2
    ):
        contribution = min(
            0.15,
            0.05 *
            item.reschedule_count,
        )

        score += contribution

        factors.append(
            _factor(
                "multiple_reschedules",
                "Multiple reschedules",
                contribution,
            )
        )

    if (
        item.days_since_last_visit
        is not None and
        item.days_since_last_visit >
        365
    ):
        score += 0.06

        factors.append(
            _factor(
                "long_visit_gap",
                "Long gap since last visit",
                0.06,
            )
        )

    if item.is_weekend:
        score += 0.03

        factors.append(
            _factor(
                "weekend",
                "Weekend appointment",
                0.03,
            )
        )

    if item.is_evening:
        score += 0.03

        factors.append(
            _factor(
                "evening",
                "Evening appointment",
                0.03,
            )
        )

    if (
        item.reminder_status ==
        "confirmed"
    ):
        score -= 0.22

        factors.append(
            _factor(
                "confirmed",
                "Customer confirmed attendance",
                -0.22,
            )
        )
    elif (
        item.reminder_status ==
        "sent"
    ):
        score -= 0.08

        factors.append(
            _factor(
                "reminder_sent",
                "Reminder delivered",
                -0.08,
            )
        )
    elif (
        item.reminder_status ==
        "none"
    ):
        score += 0.05

        factors.append(
            _factor(
                "no_reminder",
                "No reminder recorded",
                0.05,
            )
        )

    if (
        item.deposit_status ==
        "paid"
    ):
        score -= 0.24

        factors.append(
            _factor(
                "deposit_paid",
                "Deposit paid",
                -0.24,
            )
        )
    elif (
        item.deposit_status ==
        "requested"
    ):
        score -= 0.06

        factors.append(
            _factor(
                "deposit_requested",
                "Deposit requested",
                -0.06,
            )
        )

    return (
        _clamp(score),
        factors,
    )


def _actions(
    item: AppointmentRiskObservation,
    risk_level: str,
) -> list[str]:
    actions: list[str] = []

    if risk_level == "high":
        if (
            item.reminder_status !=
            "confirmed"
        ):
            actions.append(
                "Send a confirmation request and require an explicit response."
            )

        if (
            item.deposit_status !=
            "paid"
        ):
            actions.append(
                "Request a deposit or pre-authorisation before the appointment."
            )

        actions.append(
            "Prepare a waitlist customer who can fill the slot at short notice."
        )

    elif (
        risk_level ==
        "medium"
    ):
        if (
            item.reminder_status in
            {
                "none",
                "scheduled",
            }
        ):
            actions.append(
                "Send an SMS or WhatsApp reminder 24 to 48 hours before the visit."
            )

        actions.append(
            "Ask the customer to confirm or reschedule through a direct booking link."
        )

    else:
        actions.append(
            "Use the standard reminder workflow."
        )

    if (
        item.previous_no_shows >
        0
    ):
        actions.append(
            "Apply the salon's repeat no-show policy consistently."
        )

    return actions[:5]


def predict_no_shows(
    payload: NoShowPredictionRequest,
    provider_mode: str = "mock",
) -> NoShowPredictionResponse:
    predictions: list[
        AppointmentNoShowPrediction
    ] = []

    for item in payload.appointments:
        (
            probability,
            factors,
        ) = _score(item)

        if (
            probability >=
            payload.settings.high_risk_threshold
        ):
            risk_level = "high"

        elif (
            probability >=
            payload.settings.medium_risk_threshold
        ):
            risk_level = "medium"

        else:
            risk_level = "low"

        history_volume = min(
            1.0,
            item.previous_bookings /
            12,
        )

        confidence = round(
            _clamp(
                0.55 +
                history_volume *
                0.35
            ),
            4,
        )

        predictions.append(
            AppointmentNoShowPrediction(
                appointment_key=(
                    item.appointment_key
                ),
                customer_key=(
                    item.customer_key
                ),
                appointment_date=(
                    item.appointment_date
                ),
                service_name=(
                    item.service_name
                ),
                appointment_value=(
                    item.appointment_value
                ),
                probability=round(
                    probability,
                    4,
                ),
                risk_level=(
                    risk_level
                ),
                confidence=(
                    confidence
                ),
                risk_factors=sorted(
                    factors,
                    key=lambda factor:
                        abs(
                            factor.contribution
                        ),
                    reverse=True,
                ),
                recommended_actions=(
                    _actions(
                        item,
                        risk_level,
                    )
                    if (
                        payload.settings
                        .include_recommendations
                    )
                    else []
                ),
            )
        )

    predictions.sort(
        key=lambda item: (
            item.probability,
            item.appointment_value,
        ),
        reverse=True,
    )

    high = sum(
        item.risk_level ==
        "high"
        for item in predictions
    )

    medium = sum(
        item.risk_level ==
        "medium"
        for item in predictions
    )

    low = sum(
        item.risk_level ==
        "low"
        for item in predictions
    )

    expected = sum(
        item.probability
        for item in predictions
    )

    revenue_at_risk = sum(
        item.appointment_value *
        item.probability
        for item in predictions
    )

    average = (
        expected /
        len(predictions)
    )

    recommendations: list[
        str
    ] = []

    if high:
        recommendations.append(
            f"Prioritise confirmation and deposit workflows for {high} high-risk appointment(s)."
        )

    if medium:
        recommendations.append(
            f"Send enhanced reminders for {medium} medium-risk appointment(s)."
        )

    if revenue_at_risk > 0:
        recommendations.append(
            f"Approximately £{revenue_at_risk:,.2f} of booked revenue is risk-weighted."
        )

    return NoShowPredictionResponse(
        generated_at=(
            datetime
            .now(timezone.utc)
            .isoformat()
        ),
        as_of_date=(
            payload.as_of_date
        ),
        summary=(
            NoShowPredictionSummary(
                total_appointments=(
                    len(predictions)
                ),
                high_risk_count=(
                    high
                ),
                medium_risk_count=(
                    medium
                ),
                low_risk_count=(
                    low
                ),
                expected_no_shows=round(
                    expected,
                    2,
                ),
                revenue_at_risk=round(
                    revenue_at_risk,
                    2,
                ),
                average_probability=round(
                    average,
                    4,
                ),
                recommended_actions=(
                    recommendations
                ),
            )
        ),
        predictions=predictions,
        metadata=ServiceMetadata(
            model_name=MODEL_NAME,
            provider_mode=(
                provider_mode
            ),
            rules_applied=(
                RULES_APPLIED
            ),
        ),
    )


build_no_show_predictions = (
    predict_no_shows
)


__all__ = [
    "MODEL_NAME",
    "RULES_APPLIED",
    "build_no_show_predictions",
    "predict_no_shows",
]
