from __future__ import annotations

import math

from collections import defaultdict
from datetime import (
    date,
    datetime,
    timedelta,
    timezone,
)
from statistics import (
    NormalDist,
    fmean,
    pstdev,
)

from app.schemas.common import ServiceMetadata
from app.schemas.demand_forecasting import (
    AppointmentDemandForecastRequest,
    AppointmentDemandForecastResponse,
    DailyDemandForecast,
    DailyDemandObservation,
    DemandForecastSummary,
    DemandTrend,
    ServiceDemandForecast,
    TimeBucketDemandForecast,
    UtilisationRisk,
)


MODEL_NAME = (
    "salonai-demand-forecast-rules-v1"
)

MINIMUM_RATE_SAMPLE = 5

TREND_RISING_THRESHOLD = 1.08
TREND_FALLING_THRESHOLD = 0.92

PEAK_DAY_THRESHOLD = 1.15
QUIET_DAY_THRESHOLD = 0.75

MAX_TREND_MULTIPLIER = 1.60
MIN_TREND_MULTIPLIER = 0.60

EPSILON = 0.000001


def _safe_mean(
    values: list[float],
    fallback: float = 0,
) -> float:
    clean_values = [
        float(value)
        for value in values
        if math.isfinite(float(value))
    ]

    if not clean_values:
        return float(fallback)

    return float(
        fmean(clean_values)
    )


def _safe_rate(
    numerator: float,
    denominator: float,
    fallback: float = 0,
) -> float:
    if denominator <= 0:
        return float(fallback)

    return max(
        0,
        min(
            1,
            float(numerator)
            / float(denominator),
        ),
    )


def _clamp(
    value: float,
    minimum: float,
    maximum: float,
) -> float:
    return min(
        maximum,
        max(
            minimum,
            float(value),
        ),
    )


def _round_number(
    value: float,
    places: int = 2,
) -> float:
    return round(
        max(
            0,
            float(value),
        ),
        places,
    )


def _round_signed(
    value: float,
    places: int = 2,
) -> float:
    return round(
        float(value),
        places,
    )


def _date_window(
    observations: list[
        DailyDemandObservation
    ],
    *,
    end_date: date,
    days: int,
) -> list[DailyDemandObservation]:
    start_date = (
        end_date
        - timedelta(
            days=days - 1,
        )
    )

    return [
        observation
        for observation in observations
        if (
            start_date
            <= observation.business_date
            <= end_date
        )
    ]


def _observations_for_weekday(
    observations: list[
        DailyDemandObservation
    ],
    weekday: int,
) -> list[DailyDemandObservation]:
    return [
        observation
        for observation in observations
        if (
            observation.business_date.weekday()
            == weekday
        )
    ]


def _recency_weight(
    observation_date: date,
    *,
    as_of_date: date,
    half_life_days: float = 42,
) -> float:
    age_days = max(
        0,
        (
            as_of_date
            - observation_date
        ).days,
    )

    return math.exp(
        -math.log(2)
        * age_days
        / max(
            1,
            half_life_days,
        )
    )


def _weighted_mean(
    observations: list[
        DailyDemandObservation
    ],
    *,
    as_of_date: date,
    value_getter,
    fallback: float = 0,
) -> float:
    if not observations:
        return float(fallback)

    weighted_total = 0.0
    total_weight = 0.0

    for observation in observations:
        weight = _recency_weight(
            observation.business_date,
            as_of_date=as_of_date,
        )

        value = float(
            value_getter(
                observation
            )
            or 0
        )

        weighted_total += (
            value * weight
        )

        total_weight += weight

    if total_weight <= 0:
        return float(fallback)

    return (
        weighted_total
        / total_weight
    )


def _trend_from_ratio(
    ratio: float,
) -> DemandTrend:
    if (
        ratio
        >= TREND_RISING_THRESHOLD
    ):
        return "rising"

    if (
        ratio
        <= TREND_FALLING_THRESHOLD
    ):
        return "falling"

    return "stable"


def _calculate_global_trend(
    *,
    recent_observations: list[
        DailyDemandObservation
    ],
    baseline_observations: list[
        DailyDemandObservation
    ],
) -> tuple[float, DemandTrend]:
    recent_average = _safe_mean(
        [
            observation.booked_appointments
            for observation
            in recent_observations
        ]
    )

    baseline_average = _safe_mean(
        [
            observation.booked_appointments
            for observation
            in baseline_observations
        ]
    )

    if baseline_average <= 0:
        if recent_average > 0:
            return (
                1.0,
                "stable",
            )

        return (
            1.0,
            "stable",
        )

    ratio = _clamp(
        recent_average
        / baseline_average,
        MIN_TREND_MULTIPLIER,
        MAX_TREND_MULTIPLIER,
    )

    return (
        ratio,
        _trend_from_ratio(
            ratio
        ),
    )


def _status_rates(
    observations: list[
        DailyDemandObservation
    ],
) -> dict[str, float]:
    total_booked = sum(
        observation.booked_appointments
        for observation in observations
    )

    total_completed = sum(
        observation.completed_appointments
        for observation in observations
    )

    total_cancelled = sum(
        observation.cancelled_appointments
        for observation in observations
    )

    total_no_show = sum(
        observation.no_show_appointments
        for observation in observations
    )

    if (
        total_booked
        < MINIMUM_RATE_SAMPLE
    ):
        return {
            "completion": 0.82,
            "cancellation": 0.12,
            "no_show": 0.06,
        }

    completion_rate = _safe_rate(
        total_completed,
        total_booked,
    )

    cancellation_rate = _safe_rate(
        total_cancelled,
        total_booked,
    )

    no_show_rate = _safe_rate(
        total_no_show,
        total_booked,
    )

    total_resolved_rate = (
        completion_rate
        + cancellation_rate
        + no_show_rate
    )

    if total_resolved_rate <= 0:
        return {
            "completion": 0.82,
            "cancellation": 0.12,
            "no_show": 0.06,
        }

    if total_resolved_rate > 1:
        completion_rate /= (
            total_resolved_rate
        )

        cancellation_rate /= (
            total_resolved_rate
        )

        no_show_rate /= (
            total_resolved_rate
        )

    unresolved_rate = max(
        0,
        1
        - (
            completion_rate
            + cancellation_rate
            + no_show_rate
        ),
    )

    completion_rate += (
        unresolved_rate * 0.82
    )

    cancellation_rate += (
        unresolved_rate * 0.12
    )

    no_show_rate += (
        unresolved_rate * 0.06
    )

    return {
        "completion": _clamp(
            completion_rate,
            0,
            1,
        ),

        "cancellation": _clamp(
            cancellation_rate,
            0,
            1,
        ),

        "no_show": _clamp(
            no_show_rate,
            0,
            1,
        ),
    }


def _average_revenue_per_completion(
    observations: list[
        DailyDemandObservation
    ],
) -> float:
    total_revenue = sum(
        observation.total_revenue
        for observation in observations
    )

    total_completed = sum(
        observation.completed_appointments
        for observation in observations
    )

    if total_completed <= 0:
        return 0

    return max(
        0,
        total_revenue
        / total_completed,
    )


def _historical_capacity(
    observations: list[
        DailyDemandObservation
    ],
    *,
    appointments_per_staff_hour: float,
) -> float:
    explicit_capacity = [
        float(
            observation.appointment_capacity
        )
        for observation in observations
        if (
            observation.appointment_capacity
            > 0
        )
    ]

    if explicit_capacity:
        return _safe_mean(
            explicit_capacity
        )

    calculated_capacity = [
        (
            observation.available_staff_hours
            * appointments_per_staff_hour
        )
        for observation in observations
        if (
            observation.available_staff_hours
            > 0
        )
    ]

    return _safe_mean(
        calculated_capacity
    )


def _forecast_error_standard_deviation(
    observations: list[
        DailyDemandObservation
    ],
    *,
    as_of_date: date,
) -> float:
    if len(observations) < 2:
        return 1.0

    weekday_averages: dict[
        int,
        float,
    ] = {}

    for weekday in range(7):
        weekday_observations = (
            _observations_for_weekday(
                observations,
                weekday,
            )
        )

        if weekday_observations:
            weekday_averages[
                weekday
            ] = _weighted_mean(
                weekday_observations,
                as_of_date=as_of_date,
                value_getter=lambda item:
                    item.booked_appointments,
            )

    residuals: list[float] = []

    global_average = _safe_mean(
        [
            observation.booked_appointments
            for observation
            in observations
        ]
    )

    for observation in observations:
        expected = (
            weekday_averages.get(
                observation.business_date.weekday(),
                global_average,
            )
        )

        residuals.append(
            observation.booked_appointments
            - expected
        )

    deviation = (
        pstdev(residuals)
        if len(residuals) > 1
        else 1.0
    )

    return max(
        0.75,
        float(deviation),
    )


def _confidence_multiplier(
    confidence_level: float,
) -> float:
    probability = (
        0.5
        + (
            confidence_level
            / 2
        )
    )

    return NormalDist().inv_cdf(
        probability
    )


def _service_history(
    observations: list[
        DailyDemandObservation
    ],
) -> dict[
    str,
    dict[str, object],
]:
    result: dict[
        str,
        dict[str, object],
    ] = {}

    for observation in observations:
        for service in observation.services:
            entry = result.setdefault(
                service.service_key,
                {
                    "name":
                        service.service_name,

                    "booked":
                        0.0,

                    "completed":
                        0.0,

                    "cancelled":
                        0.0,

                    "no_show":
                        0.0,

                    "revenue":
                        0.0,

                    "dates": [],
                },
            )

            entry["name"] = (
                service.service_name
            )

            entry["booked"] = (
                float(
                    entry["booked"]
                )
                + service.booked_appointments
            )

            entry["completed"] = (
                float(
                    entry["completed"]
                )
                + service.completed_appointments
            )

            entry["cancelled"] = (
                float(
                    entry["cancelled"]
                )
                + service.cancelled_appointments
            )

            entry["no_show"] = (
                float(
                    entry["no_show"]
                )
                + service.no_show_appointments
            )

            entry["revenue"] = (
                float(
                    entry["revenue"]
                )
                + service.revenue
            )

            dates = entry["dates"]

            if isinstance(
                dates,
                list,
            ):
                dates.append(
                    (
                        observation.business_date,
                        service.booked_appointments,
                    )
                )

    return result


def _service_forecasts_for_date(
    *,
    predicted_bookings: float,
    target_weekday: int,
    baseline_observations: list[
        DailyDemandObservation
    ],
    recent_observations: list[
        DailyDemandObservation
    ],
) -> list[ServiceDemandForecast]:
    weekday_history = (
        _observations_for_weekday(
            baseline_observations,
            target_weekday,
        )
    )

    source_observations = (
        weekday_history
        if weekday_history
        else baseline_observations
    )

    baseline_services = (
        _service_history(
            source_observations
        )
    )

    recent_services = (
        _service_history(
            recent_observations
        )
    )

    total_service_bookings = sum(
        float(
            entry["booked"]
        )
        for entry
        in baseline_services.values()
    )

    if total_service_bookings <= 0:
        return []

    forecasts: list[
        ServiceDemandForecast
    ] = []

    for (
        service_key,
        service_entry,
    ) in baseline_services.items():
        booked = float(
            service_entry["booked"]
        )

        demand_share = (
            booked
            / total_service_bookings
        )

        baseline_daily_average = (
            booked
            / max(
                1,
                len(source_observations),
            )
        )

        recent_entry = (
            recent_services.get(
                service_key
            )
        )

        if recent_entry:
            recent_daily_average = (
                float(
                    recent_entry["booked"]
                )
                / max(
                    1,
                    len(
                        recent_observations
                    ),
                )
            )
        else:
            recent_daily_average = 0

        if baseline_daily_average > 0:
            trend_ratio = _clamp(
                recent_daily_average
                / baseline_daily_average,
                MIN_TREND_MULTIPLIER,
                MAX_TREND_MULTIPLIER,
            )
        else:
            trend_ratio = 1

        trend = _trend_from_ratio(
            trend_ratio
        )

        predicted_service_demand = (
            predicted_bookings
            * demand_share
            * (
                0.75
                + (
                    0.25
                    * trend_ratio
                )
            )
        )

        sample_size = len(
            service_entry["dates"]
        )

        confidence = _clamp(
            0.55
            + (
                min(
                    sample_size,
                    12,
                )
                * 0.025
            ),
            0.55,
            0.88,
        )

        service_name = str(
            service_entry["name"]
        )

        forecasts.append(
            ServiceDemandForecast(
                service_key=service_key,

                service_name=
                    service_name,

                predicted_appointments=
                    _round_number(
                        predicted_service_demand,
                    ),

                demand_share=
                    round(
                        _clamp(
                            demand_share,
                            0,
                            1,
                        ),
                        4,
                    ),

                trend=trend,

                confidence=
                    round(
                        confidence,
                        3,
                    ),

                explanation=(
                    f"{service_name} represents "
                    f"{demand_share:.0%} of comparable "
                    f"historical demand and is currently "
                    f"{trend}."
                ),
            )
        )

    forecasts.sort(
        key=lambda item: (
            -item.predicted_appointments,
            item.service_name.lower(),
        )
    )

    return forecasts[:10]


def _time_bucket_forecasts_for_date(
    *,
    predicted_bookings: float,
    target_weekday: int,
    baseline_observations: list[
        DailyDemandObservation
    ],
) -> list[TimeBucketDemandForecast]:
    weekday_history = (
        _observations_for_weekday(
            baseline_observations,
            target_weekday,
        )
    )

    source_observations = (
        weekday_history
        if weekday_history
        else baseline_observations
    )

    bucket_totals: dict[
        str,
        float,
    ] = defaultdict(float)

    for observation in source_observations:
        for item in observation.time_buckets:
            bucket_totals[
                item.bucket
            ] += (
                item.booked_appointments
            )

    total_bucket_bookings = sum(
        bucket_totals.values()
    )

    if total_bucket_bookings <= 0:
        return []

    forecasts: list[
        TimeBucketDemandForecast
    ] = []

    bucket_order = [
        "morning",
        "afternoon",
        "evening",
    ]

    for bucket in bucket_order:
        bucket_total = (
            bucket_totals.get(
                bucket,
                0,
            )
        )

        if bucket_total <= 0:
            continue

        share = (
            bucket_total
            / total_bucket_bookings
        )

        predicted = (
            predicted_bookings
            * share
        )

        if share >= 0.45:
            staffing_signal = (
                "Concentrate staffing coverage "
                "in this period."
            )
        elif share >= 0.30:
            staffing_signal = (
                "Maintain standard staffing "
                "coverage in this period."
            )
        else:
            staffing_signal = (
                "Use lighter coverage unless "
                "advance bookings increase."
            )

        forecasts.append(
            TimeBucketDemandForecast(
                bucket=bucket,

                predicted_appointments=
                    _round_number(
                        predicted,
                    ),

                demand_share=
                    round(
                        _clamp(
                            share,
                            0,
                            1,
                        ),
                        4,
                    ),

                staffing_signal=
                    staffing_signal,
            )
        )

    return forecasts


def _utilisation_risk(
    *,
    expected_utilisation: float,
    target_utilisation: float,
    historical_capacity: float,
) -> UtilisationRisk:
    if historical_capacity <= 0:
        return "unknown"

    if (
        expected_utilisation
        >= max(
            1,
            target_utilisation
            * 1.15,
        )
    ):
        return "high"

    if (
        expected_utilisation
        <= target_utilisation
        * 0.60
    ):
        return "low"

    return "balanced"


def _daily_explanation(
    *,
    forecast_date: date,
    predicted_bookings: float,
    weekday_average: float,
    global_trend: DemandTrend,
    utilisation_risk: UtilisationRisk,
) -> str:
    day_name = (
        forecast_date.strftime(
            "%A"
        )
    )

    parts = [
        (
            f"{day_name} demand is forecast at "
            f"{predicted_bookings:.1f} bookings"
        ),
        (
            f"from a comparable-weekday average "
            f"of {weekday_average:.1f}"
        ),
        (
            f"with an overall {global_trend} "
            f"booking trend"
        ),
    ]

    if utilisation_risk == "high":
        parts.append(
            "and likely capacity pressure"
        )
    elif utilisation_risk == "low":
        parts.append(
            "and spare appointment capacity"
        )
    elif utilisation_risk == "balanced":
        parts.append(
            "and balanced expected utilisation"
        )
    else:
        parts.append(
            "with insufficient capacity data "
            "for a utilisation assessment"
        )

    return (
        ", ".join(parts)
        + "."
    )


def _data_quality_warnings(
    *,
    payload:
        AppointmentDemandForecastRequest,
    baseline_observations: list[
        DailyDemandObservation
    ],
) -> list[str]:
    warnings: list[str] = []

    history_span_days = (
        payload.as_of_date
        - payload.observations[
            0
        ].business_date
    ).days + 1

    if (
        history_span_days
        < payload.settings.minimum_history_days
    ):
        warnings.append(
            "The available history is shorter "
            "than the configured minimum history "
            "period, so confidence intervals may "
            "be wider."
        )

    business_observations = [
        observation
        for observation
        in baseline_observations
        if (
            observation.business_date.weekday()
            in payload.settings.business_days
        )
    ]

    if len(
        business_observations
    ) < 28:
        warnings.append(
            "Fewer than 28 business-day "
            "observations are available."
        )

    missing_capacity_days = sum(
        1
        for observation
        in business_observations
        if (
            observation.appointment_capacity
            <= 0
            and observation.available_staff_hours
            <= 0
        )
    )

    if (
        business_observations
        and (
            missing_capacity_days
            / len(
                business_observations
            )
        )
        >= 0.50
    ):
        warnings.append(
            "Capacity or staff-hour data is "
            "missing for at least half of the "
            "historical business days."
        )

    service_days = sum(
        1
        for observation
        in business_observations
        if observation.services
    )

    if (
        business_observations
        and service_days
        < len(
            business_observations
        )
        * 0.50
    ):
        warnings.append(
            "Service-level history is incomplete, "
            "so service-demand forecasts may be "
            "less reliable."
        )

    time_bucket_days = sum(
        1
        for observation
        in business_observations
        if observation.time_buckets
    )

    if (
        business_observations
        and time_bucket_days
        < len(
            business_observations
        )
        * 0.50
    ):
        warnings.append(
            "Time-of-day history is incomplete, "
            "so staffing-period recommendations "
            "may be less reliable."
        )

    total_bookings = sum(
        observation.booked_appointments
        for observation
        in business_observations
    )

    if total_bookings < 50:
        warnings.append(
            "The forecast is based on fewer than "
            "50 historical appointments."
        )

    return warnings


def _service_summary_insights(
    forecasts: list[
        DailyDemandForecast
    ],
) -> list[str]:
    totals: dict[
        str,
        dict[str, object],
    ] = {}

    for forecast in forecasts:
        for service in (
            forecast.service_forecasts
        ):
            entry = totals.setdefault(
                service.service_key,
                {
                    "name":
                        service.service_name,

                    "appointments":
                        0.0,

                    "trends":
                        [],
                },
            )

            entry["appointments"] = (
                float(
                    entry["appointments"]
                )
                + service.predicted_appointments
            )

            trends = entry["trends"]

            if isinstance(
                trends,
                list,
            ):
                trends.append(
                    service.trend
                )

    ranked = sorted(
        totals.values(),
        key=lambda item:
            -float(
                item["appointments"]
            ),
    )

    insights: list[str] = []

    for item in ranked[:5]:
        trends = item["trends"]

        rising_count = (
            trends.count("rising")
            if isinstance(
                trends,
                list,
            )
            else 0
        )

        falling_count = (
            trends.count("falling")
            if isinstance(
                trends,
                list,
            )
            else 0
        )

        if rising_count > falling_count:
            trend_text = "rising"
        elif falling_count > rising_count:
            trend_text = "falling"
        else:
            trend_text = "stable"

        insights.append(
            f"{item['name']} is forecast for "
            f"{float(item['appointments']):.1f} "
            f"appointments with a {trend_text} "
            f"demand pattern."
        )

    return insights


def build_appointment_demand_forecast(
    payload:
        AppointmentDemandForecastRequest,
    *,
    provider_mode: str = "mock",
) -> AppointmentDemandForecastResponse:
    """
    Build a deterministic and explainable
    appointment-demand forecast.

    The Phase 4.5 model intentionally avoids
    personally identifiable customer data and
    external machine-learning dependencies.
    """

    settings = payload.settings

    baseline_observations = _date_window(
        payload.observations,
        end_date=payload.as_of_date,
        days=settings.baseline_window_days,
    )

    if not baseline_observations:
        baseline_observations = list(
            payload.observations
        )

    recent_observations = _date_window(
        payload.observations,
        end_date=payload.as_of_date,
        days=settings.recent_window_days,
    )

    if not recent_observations:
        recent_observations = list(
            baseline_observations
        )

    (
        global_trend_ratio,
        global_trend,
    ) = _calculate_global_trend(
        recent_observations=
            recent_observations,

        baseline_observations=
            baseline_observations,
    )

    status_rates = _status_rates(
        recent_observations
    )

    revenue_per_completion = (
        _average_revenue_per_completion(
            recent_observations
        )
    )

    error_deviation = (
        _forecast_error_standard_deviation(
            baseline_observations,
            as_of_date=
                payload.as_of_date,
        )
    )

    confidence_multiplier = (
        _confidence_multiplier(
            settings.confidence_level
        )
    )

    global_business_average = (
        _safe_mean(
            [
                observation
                .booked_appointments
                for observation
                in baseline_observations
                if (
                    observation
                    .business_date
                    .weekday()
                    in settings.business_days
                )
            ]
        )
    )

    forecast_start = (
        payload.as_of_date
        + timedelta(days=1)
    )

    forecast_dates = [
        forecast_start
        + timedelta(days=index)
        for index
        in range(
            settings.horizon_days
        )
    ]

    forecasts: list[
        DailyDemandForecast
    ] = []

    for forecast_date in forecast_dates:
        target_weekday = (
            forecast_date.weekday()
        )

        is_business_day = (
            target_weekday
            in settings.business_days
        )

        if not is_business_day:
            forecasts.append(
                DailyDemandForecast(
                    forecast_date=
                        forecast_date,

                    day_name=
                        forecast_date
                        .strftime("%A"),

                    predicted_bookings=0,

                    lower_bound=0,

                    upper_bound=0,

                    predicted_completed=0,

                    predicted_cancellations=0,

                    predicted_no_shows=0,

                    predicted_revenue=0,

                    required_staff_hours=0,

                    recommended_staff_count=0,

                    historical_capacity=0,

                    expected_utilisation=0,

                    utilisation_risk=
                        "unknown",

                    demand_index=0,

                    is_peak_day=False,

                    service_forecasts=[],

                    time_bucket_forecasts=[],

                    explanation=(
                        "The salon is configured "
                        "as closed on this weekday."
                    ),
                )
            )

            continue

        weekday_baseline = (
            _observations_for_weekday(
                baseline_observations,
                target_weekday,
            )
        )

        weekday_recent = (
            _observations_for_weekday(
                recent_observations,
                target_weekday,
            )
        )

        weekday_source = (
            weekday_baseline
            if weekday_baseline
            else baseline_observations
        )

        weekday_average = (
            _weighted_mean(
                weekday_source,
                as_of_date=
                    payload.as_of_date,

                value_getter=lambda item:
                    item.booked_appointments,

                fallback=
                    global_business_average,
            )
        )

        recent_weekday_average = (
            _weighted_mean(
                weekday_recent,
                as_of_date=
                    payload.as_of_date,

                value_getter=lambda item:
                    item.booked_appointments,

                fallback=
                    weekday_average,
            )
        )

        if weekday_average > 0:
            weekday_trend_ratio = (
                _clamp(
                    recent_weekday_average
                    / weekday_average,

                    MIN_TREND_MULTIPLIER,

                    MAX_TREND_MULTIPLIER,
                )
            )
        else:
            weekday_trend_ratio = (
                global_trend_ratio
            )

        blended_trend_ratio = (
            (
                global_trend_ratio
                * 0.55
            )
            + (
                weekday_trend_ratio
                * 0.45
            )
        )

        predicted_bookings = max(
            0,
            (
                weekday_average
                * (
                    0.70
                    + (
                        blended_trend_ratio
                        * 0.30
                    )
                )
            ),
        )

        interval_width = (
            confidence_multiplier
            * error_deviation
        )

        lower_bound = max(
            0,
            predicted_bookings
            - interval_width,
        )

        upper_bound = max(
            predicted_bookings,
            predicted_bookings
            + interval_width,
        )

        predicted_completed = (
            predicted_bookings
            * status_rates[
                "completion"
            ]
        )

        predicted_cancellations = (
            predicted_bookings
            * status_rates[
                "cancellation"
            ]
        )

        predicted_no_shows = (
            predicted_bookings
            * status_rates[
                "no_show"
            ]
        )

        predicted_revenue = (
            predicted_completed
            * revenue_per_completion
            if (
                settings
                .include_revenue_forecast
            )
            else 0
        )

        historical_capacity = (
            _historical_capacity(
                weekday_source,

                appointments_per_staff_hour=
                    settings
                    .appointments_per_staff_hour,
            )
        )

        effective_hourly_capacity = (
            settings
            .appointments_per_staff_hour
            * settings.target_utilisation
        )

        required_staff_hours = (
            predicted_bookings
            / max(
                EPSILON,
                effective_hourly_capacity,
            )
        )

        recommended_staff_count = (
            math.ceil(
                required_staff_hours
                / settings.staff_shift_hours
            )
            if predicted_bookings > 0
            else 0
        )

        expected_utilisation = (
            predicted_bookings
            / historical_capacity
            if historical_capacity > 0
            else 0
        )

        utilisation_risk = (
            _utilisation_risk(
                expected_utilisation=
                    expected_utilisation,

                target_utilisation=
                    settings
                    .target_utilisation,

                historical_capacity=
                    historical_capacity,
            )
        )

        if global_business_average > 0:
            demand_index = (
                predicted_bookings
                / global_business_average
            )
        else:
            demand_index = 1

        service_forecasts = (
            _service_forecasts_for_date(
                predicted_bookings=
                    predicted_bookings,

                target_weekday=
                    target_weekday,

                baseline_observations=
                    baseline_observations,

                recent_observations=
                    recent_observations,
            )
        )

        time_bucket_forecasts = (
            _time_bucket_forecasts_for_date(
                predicted_bookings=
                    predicted_bookings,

                target_weekday=
                    target_weekday,

                baseline_observations=
                    baseline_observations,
            )
        )

        forecasts.append(
            DailyDemandForecast(
                forecast_date=
                    forecast_date,

                day_name=
                    forecast_date
                    .strftime("%A"),

                predicted_bookings=
                    _round_number(
                        predicted_bookings,
                    ),

                lower_bound=
                    _round_number(
                        lower_bound,
                    ),

                upper_bound=
                    _round_number(
                        upper_bound,
                    ),

                predicted_completed=
                    _round_number(
                        predicted_completed,
                    ),

                predicted_cancellations=
                    _round_number(
                        predicted_cancellations,
                    ),

                predicted_no_shows=
                    _round_number(
                        predicted_no_shows,
                    ),

                predicted_revenue=
                    _round_number(
                        predicted_revenue,
                    ),

                required_staff_hours=
                    _round_number(
                        required_staff_hours,
                    ),

                recommended_staff_count=
                    recommended_staff_count,

                historical_capacity=
                    _round_number(
                        historical_capacity,
                    ),

                expected_utilisation=
                    _round_number(
                        expected_utilisation,
                        4,
                    ),

                utilisation_risk=
                    utilisation_risk,

                demand_index=
                    _round_number(
                        demand_index,
                        4,
                    ),

                is_peak_day=False,

                service_forecasts=
                    service_forecasts,

                time_bucket_forecasts=
                    time_bucket_forecasts,

                explanation=
                    _daily_explanation(
                        forecast_date=
                            forecast_date,

                        predicted_bookings=
                            predicted_bookings,

                        weekday_average=
                            weekday_average,

                        global_trend=
                            global_trend,

                        utilisation_risk=
                            utilisation_risk,
                    ),
            )
        )

    business_forecasts = [
        forecast
        for forecast in forecasts
        if forecast.predicted_bookings > 0
    ]

    average_daily_bookings = (
        _safe_mean(
            [
                forecast
                .predicted_bookings
                for forecast
                in business_forecasts
            ]
        )
    )

    peak_dates: list[date] = []
    quiet_dates: list[date] = []
    staffing_alerts: list[str] = []

    for forecast in forecasts:
        if forecast.predicted_bookings <= 0:
            continue

        if (
            average_daily_bookings > 0
            and forecast.predicted_bookings
            >= (
                average_daily_bookings
                * PEAK_DAY_THRESHOLD
            )
        ):
            forecast.is_peak_day = True

            peak_dates.append(
                forecast.forecast_date
            )

        if (
            average_daily_bookings > 0
            and forecast.predicted_bookings
            <= (
                average_daily_bookings
                * QUIET_DAY_THRESHOLD
            )
        ):
            quiet_dates.append(
                forecast.forecast_date
            )

        if (
            forecast.utilisation_risk
            == "high"
        ):
            staffing_alerts.append(
                (
                    f"{forecast.forecast_date.isoformat()}: "
                    f"forecast demand requires approximately "
                    f"{forecast.required_staff_hours:.1f} "
                    f"staff hours and "
                    f"{forecast.recommended_staff_count} "
                    f"staff members."
                )
            )

    total_predicted_bookings = sum(
        forecast.predicted_bookings
        for forecast
        in forecasts
    )

    total_predicted_revenue = sum(
        forecast.predicted_revenue
        for forecast
        in forecasts
    )

    average_daily_revenue = (
        _safe_mean(
            [
                forecast
                .predicted_revenue
                for forecast
                in business_forecasts
            ]
        )
    )

    data_quality_warnings = (
        _data_quality_warnings(
            payload=payload,

            baseline_observations=
                baseline_observations,
        )
    )

    service_insights = (
        _service_summary_insights(
            forecasts
        )
    )

    rules_applied = [
        "weekday-seasonality",
        "recency-weighting",
        "recent-baseline-trend",
        "historical-status-rates",
        "confidence-interval",
        "capacity-utilisation",
        "rota-staff-hours",
        "service-demand-mix",
        "time-bucket-demand-mix",
    ]

    if (
        settings
        .include_revenue_forecast
    ):
        rules_applied.append(
            "revenue-per-completed-appointment"
        )

    return (
        AppointmentDemandForecastResponse(
            generated_at=datetime.now(
                timezone.utc
            ),

            as_of_date=
                payload.as_of_date,

            forecast_start=
                forecast_start,

            forecast_end=
                forecast_dates[-1],

            history_start=
                payload.observations[
                    0
                ].business_date,

            history_end=
                payload.observations[
                    -1
                ].business_date,

            forecasts=forecasts,

            summary=
                DemandForecastSummary(
                    total_predicted_bookings=
                        _round_number(
                            total_predicted_bookings,
                        ),

                    average_daily_bookings=
                        _round_number(
                            average_daily_bookings,
                        ),

                    total_predicted_revenue=
                        _round_number(
                            total_predicted_revenue,
                        ),

                    average_daily_revenue=
                        _round_number(
                            average_daily_revenue,
                        ),

                    predicted_cancellation_rate=
                        round(
                            status_rates[
                                "cancellation"
                            ],
                            4,
                        ),

                    predicted_no_show_rate=
                        round(
                            status_rates[
                                "no_show"
                            ],
                            4,
                        ),

                    peak_dates=
                        peak_dates[:10],

                    quiet_dates=
                        quiet_dates[:10],

                    staffing_alerts=
                        staffing_alerts[:20],

                    service_insights=
                        service_insights,

                    data_quality_warnings=
                        data_quality_warnings,
                ),

            settings=settings,

            metadata=
                ServiceMetadata(
                    provider_mode=
                        provider_mode,

                    model_name=
                        MODEL_NAME,

                    rules_applied=
                        rules_applied,
                ),
        )
    )