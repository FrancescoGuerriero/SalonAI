from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from math import sqrt
from statistics import NormalDist, fmean, pstdev
from typing import Iterable

from app.schemas.common import ServiceMetadata
from app.schemas.sales_forecasting import (
    CategorySalesForecast,
    ChannelSalesForecast,
    DailySalesForecast,
    DailySalesObservation,
    MonthlySalesForecast,
    SalesForecastRequest,
    SalesForecastResponse,
    SalesForecastSummary,
)


MODEL_NAME = "salonai-sales-forecast-rules-v1"

RULES_APPLIED = [
    "weekday-seasonality",
    "recent-sales-trend",
    "channel-mix",
    "category-mix",
    "discount-and-refund-rates",
    "collection-rate",
    "gross-margin",
    "confidence-intervals",
    "scenario-adjustment",
]

CHANNELS = (
    "services",
    "retail",
    "memberships",
    "gift_cards",
    "other",
)

CHANNEL_LABELS = {
    "services": "Salon services",
    "retail": "Retail products",
    "memberships": "Memberships",
    "gift_cards": "Gift cards",
    "other": "Other sales",
}


def _number(
    value: float | int | None,
    fallback: float = 0.0,
) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback

    if parsed != parsed:
        return fallback

    return parsed


def _positive(
    value: float | int | None,
) -> float:
    return max(0.0, _number(value))


def _money(
    value: float | int | None,
) -> float:
    return round(
        _positive(value),
        2,
    )


def _quantity(
    value: float | int | None,
) -> float:
    return round(
        _positive(value),
        2,
    )


def _rate(
    numerator: float,
    denominator: float,
    fallback: float = 0.0,
) -> float:
    if denominator <= 0:
        return fallback

    return numerator / denominator


def _clamp(
    value: float,
    minimum: float,
    maximum: float,
) -> float:
    return min(
        maximum,
        max(
            minimum,
            value,
        ),
    )


def _average(
    values: Iterable[float],
    fallback: float = 0.0,
) -> float:
    cleaned = [
        _number(value)
        for value in values
    ]

    if not cleaned:
        return fallback

    return fmean(cleaned)


def _standard_deviation(
    values: Iterable[float],
) -> float:
    cleaned = [
        _number(value)
        for value in values
    ]

    if len(cleaned) < 2:
        return 0.0

    return pstdev(cleaned)


def _growth_rate(
    recent: float,
    baseline: float,
) -> float:
    if baseline <= 0:
        return (
            0.0
            if recent <= 0
            else 1.0
        )

    return (
        recent - baseline
    ) / baseline


def _trend(
    growth_rate: float,
) -> str:
    if growth_rate >= 0.05:
        return "rising"

    if growth_rate <= -0.05:
        return "falling"

    return "stable"


def _currency(
    value: float,
) -> str:
    return f"£{value:,.0f}"


def _percentage(
    value: float,
) -> str:
    return f"{value * 100:.1f}%"


def _business_observations(
    observations: list[
        DailySalesObservation
    ],
    business_days: list[int],
) -> list[
    DailySalesObservation
]:
    business_day_set = set(
        business_days
    )

    return [
        observation
        for observation in observations
        if (
            observation.business_date.weekday()
            in business_day_set
        )
    ]


def _window(
    observations: list[
        DailySalesObservation
    ],
    days: int,
) -> list[
    DailySalesObservation
]:
    if days <= 0:
        return []

    return observations[-days:]


def _daily_channel_value(
    observation: DailySalesObservation,
    channel: str,
) -> float:
    field_names = {
        "services": "service_sales",
        "retail": "retail_sales",
        "memberships": "membership_sales",
        "gift_cards": "gift_card_sales",
        "other": "other_sales",
    }

    field_name = field_names[channel]

    return _positive(
        getattr(
            observation,
            field_name,
            0,
        )
    )


def _channel_observation(
    observation: DailySalesObservation,
    channel: str,
):
    return next(
        (
            item
            for item in observation.channels
            if item.channel == channel
        ),
        None,
    )


def _channel_metrics(
    observations: list[
        DailySalesObservation
    ],
    recent_observations: list[
        DailySalesObservation
    ],
) -> dict[str, dict]:
    total_net_sales = sum(
        _positive(
            item.net_sales
        )
        for item in observations
    )

    recent_total_net_sales = sum(
        _positive(
            item.net_sales
        )
        for item in recent_observations
    )

    metrics: dict[str, dict] = {}

    for channel in CHANNELS:
        channel_sales = sum(
            _daily_channel_value(
                observation,
                channel,
            )
            for observation in observations
        )

        recent_channel_sales = sum(
            _daily_channel_value(
                observation,
                channel,
            )
            for observation
            in recent_observations
        )

        transactions = 0.0
        units_sold = 0.0

        for observation in observations:
            channel_item = _channel_observation(
                observation,
                channel,
            )

            if channel_item is None:
                continue

            transactions += channel_item.transactions
            units_sold += channel_item.units_sold

        baseline_share = _rate(
            channel_sales,
            total_net_sales,
        )

        recent_share = _rate(
            recent_channel_sales,
            recent_total_net_sales,
            baseline_share,
        )

        share_growth = (
            recent_share
            - baseline_share
        )

        adjusted_share = max(
            0.0,
            baseline_share
            + (
                share_growth
                * 0.5
            ),
        )

        metrics[channel] = {
            "channel": channel,
            "sales": channel_sales,
            "recent_sales": recent_channel_sales,
            "baseline_share": baseline_share,
            "recent_share": recent_share,
            "adjusted_share": adjusted_share,
            "growth_rate": _growth_rate(
                recent_share,
                baseline_share,
            ),
            "transactions": transactions,
            "units_sold": units_sold,
            "transactions_per_sales": _rate(
                transactions,
                channel_sales,
            ),
            "units_per_sales": _rate(
                units_sold,
                channel_sales,
            ),
        }

    adjusted_total = sum(
        item["adjusted_share"]
        for item in metrics.values()
    )

    if adjusted_total <= 0:
        metrics["services"]["adjusted_share"] = 1.0
        adjusted_total = 1.0

    for item in metrics.values():
        item["adjusted_share"] = (
            item["adjusted_share"]
            / adjusted_total
        )

    return metrics


def _category_metrics(
    observations: list[
        DailySalesObservation
    ],
    recent_observations: list[
        DailySalesObservation
    ],
) -> list[dict]:
    baseline: dict[str, dict] = {}
    recent: dict[str, dict] = {}

    total_net_sales = sum(
        _positive(
            item.net_sales
        )
        for item in observations
    )

    recent_total_net_sales = sum(
        _positive(
            item.net_sales
        )
        for item in recent_observations
    )

    for observation in observations:
        for category in observation.categories:
            key = category.category_key

            if key not in baseline:
                baseline[key] = {
                    "category_key": key,
                    "category_name": category.category_name,
                    "channel": category.channel,
                    "net_sales": 0.0,
                    "transactions": 0.0,
                    "units_sold": 0.0,
                    "records": 0,
                }

            target = baseline[key]

            target["net_sales"] += _positive(
                category.net_sales
            )
            target["transactions"] += category.transactions
            target["units_sold"] += category.units_sold
            target["records"] += 1

    for observation in recent_observations:
        for category in observation.categories:
            key = category.category_key

            if key not in recent:
                recent[key] = {
                    "net_sales": 0.0,
                    "transactions": 0.0,
                    "units_sold": 0.0,
                }

            recent[key]["net_sales"] += _positive(
                category.net_sales
            )
            recent[key]["transactions"] += category.transactions
            recent[key]["units_sold"] += category.units_sold

    result: list[dict] = []

    for key, item in baseline.items():
        recent_item = recent.get(
            key,
            {},
        )

        baseline_share = _rate(
            item["net_sales"],
            total_net_sales,
        )

        recent_share = _rate(
            _positive(
                recent_item.get(
                    "net_sales",
                    0,
                )
            ),
            recent_total_net_sales,
            baseline_share,
        )

        adjusted_share = max(
            0.0,
            baseline_share
            + (
                (
                    recent_share
                    - baseline_share
                )
                * 0.5
            ),
        )

        result.append({
            **item,
            "baseline_share": baseline_share,
            "recent_share": recent_share,
            "adjusted_share": adjusted_share,
            "growth_rate": _growth_rate(
                recent_share,
                baseline_share,
            ),
            "transactions_per_sales": _rate(
                item["transactions"],
                item["net_sales"],
            ),
            "units_per_sales": _rate(
                item["units_sold"],
                item["net_sales"],
            ),
        })

    return sorted(
        result,
        key=lambda item: item["adjusted_share"],
        reverse=True,
    )[:20]


def _weekday_sales(
    observations: list[
        DailySalesObservation
    ],
) -> dict[int, list[float]]:
    result: dict[int, list[float]] = defaultdict(list)

    for observation in observations:
        result[
            observation.business_date.weekday()
        ].append(
            _positive(
                observation.net_sales
            )
        )

    return dict(result)


def _weekday_transactions(
    observations: list[
        DailySalesObservation
    ],
) -> dict[int, list[float]]:
    result: dict[int, list[float]] = defaultdict(list)

    for observation in observations:
        result[
            observation.business_date.weekday()
        ].append(
            _positive(
                observation.transactions
            )
        )

    return dict(result)


def _financial_rates(
    observations: list[
        DailySalesObservation
    ],
) -> dict[str, float]:
    gross_sales = sum(
        _positive(item.gross_sales)
        for item in observations
    )

    net_sales = sum(
        _positive(item.net_sales)
        for item in observations
    )

    collected_sales = sum(
        _positive(item.collected_sales)
        for item in observations
    )

    cost_of_goods = sum(
        _positive(item.cost_of_goods)
        for item in observations
    )

    discounts = sum(
        _positive(item.discounts)
        for item in observations
    )

    refunds = sum(
        _positive(item.refunds)
        for item in observations
    )

    transactions = sum(
        _positive(item.transactions)
        for item in observations
    )

    discount_rate = _clamp(
        _rate(
            discounts,
            gross_sales,
        ),
        0.0,
        0.60,
    )

    refund_rate = _clamp(
        _rate(
            refunds,
            gross_sales,
        ),
        0.0,
        0.40,
    )

    combined_reduction_rate = (
        discount_rate
        + refund_rate
    )

    if combined_reduction_rate > 0.80:
        scale = (
            0.80
            / combined_reduction_rate
        )

        discount_rate *= scale
        refund_rate *= scale

    return {
        "gross_sales": gross_sales,
        "net_sales": net_sales,
        "collected_sales": collected_sales,
        "cost_of_goods": cost_of_goods,
        "discounts": discounts,
        "refunds": refunds,
        "transactions": transactions,
        "discount_rate": discount_rate,
        "refund_rate": refund_rate,
        "collection_rate": _clamp(
            _rate(
                collected_sales,
                net_sales,
                1.0,
            ),
            0.0,
            1.25,
        ),
        "cost_rate": _clamp(
            _rate(
                cost_of_goods,
                net_sales,
            ),
            0.0,
            1.0,
        ),
        "average_transaction_value": _rate(
            net_sales,
            transactions,
        ),
    }


def _confidence_value(
    sample_count: int,
    values: list[float],
) -> float:
    average = _average(values)
    deviation = _standard_deviation(values)

    volatility = _rate(
        deviation,
        average,
    )

    confidence = (
        0.50
        + min(
            0.30,
            sample_count / 100,
        )
        - min(
            0.25,
            volatility * 0.15,
        )
    )

    return round(
        _clamp(
            confidence,
            0.35,
            0.95,
        ),
        4,
    )


def _sales_risk(
    growth_rate: float,
    discount_rate: float,
    refund_rate: float,
    gross_margin: float,
    relative_sales: float,
) -> str:
    if (
        growth_rate <= -0.15
        or refund_rate >= 0.12
        or gross_margin < 0.20
    ):
        return "high"

    if (
        growth_rate <= -0.05
        or refund_rate >= 0.07
        or discount_rate >= 0.20
        or gross_margin < 0.35
    ):
        return "medium"

    if relative_sales < 0.65:
        return "low"

    return "balanced"


def _daily_channel_forecasts(
    predicted_net_sales: float,
    channel_metrics: dict[str, dict],
    confidence_values: list[float],
) -> list[
    ChannelSalesForecast
]:
    forecasts: list[
        ChannelSalesForecast
    ] = []

    for channel in CHANNELS:
        metrics = channel_metrics[channel]

        predicted_sales = (
            predicted_net_sales
            * metrics["adjusted_share"]
        )

        if (
            predicted_sales <= 0
            and metrics["sales"] <= 0
        ):
            continue

        forecasts.append(
            ChannelSalesForecast(
                channel=channel,
                predicted_net_sales=_money(
                    predicted_sales
                ),
                predicted_transactions=_quantity(
                    predicted_sales
                    * metrics[
                        "transactions_per_sales"
                    ]
                ),
                predicted_units_sold=_quantity(
                    predicted_sales
                    * metrics[
                        "units_per_sales"
                    ]
                ),
                sales_share=round(
                    metrics["adjusted_share"],
                    6,
                ),
                growth_rate=round(
                    metrics["growth_rate"],
                    6,
                ),
                trend=_trend(
                    metrics["growth_rate"]
                ),
                confidence=_confidence_value(
                    len(confidence_values),
                    confidence_values,
                ),
            )
        )

    return forecasts


def _daily_category_forecasts(
    predicted_net_sales: float,
    category_metrics: list[dict],
    confidence_values: list[float],
) -> list[
    CategorySalesForecast
]:
    forecasts: list[
        CategorySalesForecast
    ] = []

    for metrics in category_metrics:
        predicted_sales = (
            predicted_net_sales
            * metrics["adjusted_share"]
        )

        if predicted_sales <= 0:
            continue

        forecasts.append(
            CategorySalesForecast(
                category_key=metrics[
                    "category_key"
                ],
                category_name=metrics[
                    "category_name"
                ],
                channel=metrics["channel"],
                predicted_net_sales=_money(
                    predicted_sales
                ),
                predicted_transactions=_quantity(
                    predicted_sales
                    * metrics[
                        "transactions_per_sales"
                    ]
                ),
                predicted_units_sold=_quantity(
                    predicted_sales
                    * metrics[
                        "units_per_sales"
                    ]
                ),
                sales_share=round(
                    metrics["adjusted_share"],
                    6,
                ),
                growth_rate=round(
                    metrics["growth_rate"],
                    6,
                ),
                trend=_trend(
                    metrics["growth_rate"]
                ),
                confidence=_confidence_value(
                    metrics["records"],
                    confidence_values,
                ),
            )
        )

    return forecasts


def _closed_day_forecast(
    forecast_date: date,
) -> dict:
    return {
        "forecast_date": forecast_date,
        "day_name": forecast_date.strftime(
            "%A"
        ),
        "is_business_day": False,
        "predicted_gross_sales": 0.0,
        "predicted_discounts": 0.0,
        "predicted_refunds": 0.0,
        "predicted_net_sales": 0.0,
        "predicted_collected_sales": 0.0,
        "predicted_cost_of_goods": 0.0,
        "predicted_gross_profit": 0.0,
        "predicted_transactions": 0.0,
        "predicted_service_sales": 0.0,
        "predicted_retail_sales": 0.0,
        "predicted_membership_sales": 0.0,
        "predicted_gift_card_sales": 0.0,
        "predicted_other_sales": 0.0,
        "lower_bound": 0.0,
        "upper_bound": 0.0,
        "expected_growth_rate": 0.0,
        "trend": "stable",
        "sales_risk": "unknown",
        "is_peak_day": False,
        "is_quiet_day": False,
        "channel_forecasts": [],
        "category_forecasts": [],
        "explanation": (
            f"{forecast_date.strftime('%A')} "
            "is configured as a closed salon day."
        ),
    }


def _month_key(
    value: date,
) -> str:
    return value.strftime(
        "%Y-%m"
    )


def _monthly_forecasts(
    forecasts: list[
        DailySalesForecast
    ],
) -> list[
    MonthlySalesForecast
]:
    grouped: dict[str, dict] = {}

    for forecast in forecasts:
        key = _month_key(
            forecast.forecast_date
        )

        if key not in grouped:
            grouped[key] = {
                "date": forecast.forecast_date,
                "gross": 0.0,
                "net": 0.0,
                "services": 0.0,
                "retail": 0.0,
                "profit": 0.0,
                "transactions": 0.0,
                "lower": 0.0,
                "upper": 0.0,
                "growth_rates": [],
            }

        target = grouped[key]

        target["gross"] += forecast.predicted_gross_sales
        target["net"] += forecast.predicted_net_sales
        target["services"] += forecast.predicted_service_sales
        target["retail"] += forecast.predicted_retail_sales
        target["profit"] += forecast.predicted_gross_profit
        target["transactions"] += forecast.predicted_transactions
        target["lower"] += forecast.lower_bound
        target["upper"] += forecast.upper_bound

        if forecast.is_business_day:
            target["growth_rates"].append(
                forecast.expected_growth_rate
            )

    return [
        MonthlySalesForecast(
            month=key,
            month_label=values[
                "date"
            ].strftime(
                "%B %Y"
            ),
            predicted_gross_sales=_money(
                values["gross"]
            ),
            predicted_net_sales=_money(
                values["net"]
            ),
            predicted_service_sales=_money(
                values["services"]
            ),
            predicted_retail_sales=_money(
                values["retail"]
            ),
            predicted_gross_profit=_money(
                values["profit"]
            ),
            predicted_transactions=_quantity(
                values["transactions"]
            ),
            lower_bound=_money(
                values["lower"]
            ),
            upper_bound=_money(
                values["upper"]
            ),
            expected_growth_rate=round(
                _average(
                    values["growth_rates"]
                ),
                6,
            ),
        )
        for key, values
        in sorted(
            grouped.items()
        )
    ]


def _channel_insights(
    channel_metrics: dict[str, dict],
) -> list[str]:
    ranked = sorted(
        channel_metrics.values(),
        key=lambda item: item["adjusted_share"],
        reverse=True,
    )

    insights: list[str] = []

    for item in ranked[:3]:
        if item["adjusted_share"] <= 0:
            continue

        label = CHANNEL_LABELS[
            item["channel"]
        ]

        insights.append(
            (
                f"{label} are forecast to contribute "
                f"{_percentage(item['adjusted_share'])} "
                "of net sales."
            )
        )

    fastest_growth = max(
        ranked,
        key=lambda item: item["growth_rate"],
    )

    if fastest_growth["growth_rate"] >= 0.05:
        insights.append(
            (
                f"{CHANNEL_LABELS[fastest_growth['channel']]} "
                "show the strongest recent increase "
                f"at {_percentage(fastest_growth['growth_rate'])}."
            )
        )

    falling = [
        item
        for item in ranked
        if (
            item["growth_rate"] <= -0.05
            and item["adjusted_share"] > 0
        )
    ]

    if falling:
        item = falling[0]

        insights.append(
            (
                f"{CHANNEL_LABELS[item['channel']]} "
                "are trending below their historical "
                f"share by {_percentage(abs(item['growth_rate']))}."
            )
        )

    return insights[:5]


def _category_insights(
    category_metrics: list[dict],
) -> list[str]:
    insights: list[str] = []

    for item in category_metrics[:3]:
        if item["adjusted_share"] <= 0:
            continue

        insights.append(
            (
                f"{item['category_name']} is forecast "
                "to represent approximately "
                f"{_percentage(item['adjusted_share'])} "
                "of total net sales."
            )
        )

    rising = [
        item
        for item in category_metrics
        if item["growth_rate"] >= 0.08
    ]

    if rising:
        item = max(
            rising,
            key=lambda value: value["growth_rate"],
        )

        insights.append(
            (
                f"{item['category_name']} has the strongest "
                "recent category momentum at "
                f"{_percentage(item['growth_rate'])}."
            )
        )

    falling = [
        item
        for item in category_metrics
        if item["growth_rate"] <= -0.08
    ]

    if falling:
        item = min(
            falling,
            key=lambda value: value["growth_rate"],
        )

        insights.append(
            (
                f"{item['category_name']} is showing "
                "a recent sales decline of "
                f"{_percentage(abs(item['growth_rate']))}."
            )
        )

    return insights[:5]


def _data_quality_warnings(
    payload: SalesForecastRequest,
    business_observations: list[
        DailySalesObservation
    ],
    category_metrics: list[dict],
    financial_rates: dict[
        str,
        float,
    ],
) -> list[str]:
    warnings: list[str] = []

    if (
        len(payload.observations)
        < payload.settings.minimum_history_days
    ):
        warnings.append(
            (
                "The available history is shorter than "
                "the configured minimum history period."
            )
        )

    zero_sales_days = sum(
        1
        for item in business_observations
        if item.net_sales <= 0
    )

    zero_sales_rate = _rate(
        zero_sales_days,
        len(
            business_observations
        ),
    )

    if zero_sales_rate >= 0.25:
        warnings.append(
            (
                f"{_percentage(zero_sales_rate)} of configured "
                "business-day observations contain no net sales."
            )
        )

    if (
        financial_rates["cost_of_goods"] <= 0
        and payload.settings.include_profit_forecast
    ):
        warnings.append(
            (
                "No cost-of-goods history was supplied, "
                "so gross-profit estimates may be incomplete."
            )
        )

    if (
        not category_metrics
        and payload.settings.include_category_forecast
    ):
        warnings.append(
            (
                "No category-level history was supplied, "
                "so category forecasts are unavailable."
            )
        )

    if financial_rates["transactions"] <= 0:
        warnings.append(
            (
                "Transaction counts are unavailable, "
                "so transaction-volume estimates are limited."
            )
        )

    if not warnings:
        warnings.append(
            (
                "No material data-quality issues were "
                "detected in the supplied aggregate history."
            )
        )

    return warnings


def _risk_alerts(
    growth_rate: float,
    discount_rate: float,
    refund_rate: float,
    gross_margin: float,
    collection_rate: float,
) -> list[str]:
    alerts: list[str] = []

    if growth_rate <= -0.10:
        alerts.append(
            (
                "Recent net sales are materially below "
                "the longer historical baseline."
            )
        )

    if discount_rate >= 0.20:
        alerts.append(
            (
                f"The predicted discount rate is "
                f"{_percentage(discount_rate)}, which may "
                "place pressure on margin."
            )
        )

    if refund_rate >= 0.08:
        alerts.append(
            (
                f"The predicted refund rate is "
                f"{_percentage(refund_rate)} and should "
                "be reviewed by channel and category."
            )
        )

    if gross_margin < 0.30:
        alerts.append(
            (
                f"Predicted gross margin is only "
                f"{_percentage(gross_margin)}."
            )
        )

    if collection_rate < 0.85:
        alerts.append(
            (
                f"Only {_percentage(collection_rate)} of "
                "forecast net sales are expected to be collected."
            )
        )

    return alerts


def build_sales_forecast(
    payload: SalesForecastRequest,
    provider_mode: str = "mock",
) -> SalesForecastResponse:
    observations = sorted(
        payload.observations,
        key=lambda item: item.business_date,
    )

    settings = payload.settings

    baseline_observations = _window(
        observations,
        settings.baseline_window_days,
    )

    recent_observations = _window(
        observations,
        settings.recent_window_days,
    )

    baseline_business = _business_observations(
        baseline_observations,
        settings.business_days,
    )

    recent_business = _business_observations(
        recent_observations,
        settings.business_days,
    )

    all_business = _business_observations(
        observations,
        settings.business_days,
    )

    baseline_daily_average = _average(
        [
            item.net_sales
            for item in baseline_business
        ]
    )

    recent_daily_average = _average(
        [
            item.net_sales
            for item in recent_business
        ],
        baseline_daily_average,
    )

    overall_growth_rate = _clamp(
        _growth_rate(
            recent_daily_average,
            baseline_daily_average,
        ),
        -0.50,
        1.00,
    )

    baseline_weekdays = _weekday_sales(
        baseline_business
    )

    recent_weekdays = _weekday_sales(
        recent_business
    )

    weekday_transactions = _weekday_transactions(
        baseline_business
    )

    financial_rates = _financial_rates(
        baseline_business
    )

    channel_metrics = _channel_metrics(
        baseline_business,
        recent_business,
    )

    category_metrics = (
        _category_metrics(
            baseline_business,
            recent_business,
        )
        if settings.include_category_forecast
        else []
    )

    all_baseline_values = [
        _positive(
            item.net_sales
        )
        for item in baseline_business
    ]

    global_deviation = _standard_deviation(
        all_baseline_values
    )

    confidence_z_score = NormalDist().inv_cdf(
        (
            1
            + settings.confidence_level
        )
        / 2
    )

    forecast_start = (
        payload.as_of_date
        + timedelta(days=1)
    )

    raw_forecasts: list[dict] = []
    business_day_set = set(
        settings.business_days
    )

    for offset in range(
        settings.horizon_days
    ):
        forecast_date = (
            forecast_start
            + timedelta(days=offset)
        )

        weekday = forecast_date.weekday()

        if weekday not in business_day_set:
            raw_forecasts.append(
                _closed_day_forecast(
                    forecast_date
                )
            )
            continue

        weekday_values = baseline_weekdays.get(
            weekday,
            [],
        )

        recent_weekday_values = recent_weekdays.get(
            weekday,
            [],
        )

        historical_weekday_average = _average(
            weekday_values,
            baseline_daily_average,
        )

        recent_weekday_average = _average(
            recent_weekday_values,
            recent_daily_average,
        )

        recent_trend_component = (
            recent_weekday_average
            * (
                1
                + (
                    overall_growth_rate
                    * 0.5
                )
            )
        )

        predicted_net_sales = (
            (
                historical_weekday_average
                * settings.weekday_seasonality_weight
            )
            + (
                recent_trend_component
                * settings.recent_trend_weight
            )
        )

        predicted_net_sales *= (
            1
            + settings.scenario_adjustment
        )

        predicted_net_sales = max(
            0.0,
            predicted_net_sales,
        )

        reduction_rate = (
            financial_rates["discount_rate"]
            + financial_rates["refund_rate"]
        )

        predicted_gross_sales = (
            predicted_net_sales
            / max(
                0.20,
                1
                - reduction_rate,
            )
        )

        predicted_discounts = (
            predicted_gross_sales
            * financial_rates["discount_rate"]
        )

        predicted_refunds = (
            predicted_gross_sales
            * financial_rates["refund_rate"]
        )

        predicted_collected_sales = (
            predicted_net_sales
            * financial_rates["collection_rate"]
        )

        predicted_cost_of_goods = (
            predicted_net_sales
            * financial_rates["cost_rate"]
            if settings.include_profit_forecast
            else 0.0
        )

        predicted_cost_of_goods = min(
            predicted_net_sales,
            predicted_cost_of_goods,
        )

        predicted_gross_profit = max(
            0.0,
            (
                predicted_net_sales
                - predicted_cost_of_goods
            ),
        )

        weekday_transaction_values = weekday_transactions.get(
            weekday,
            [],
        )

        predicted_transactions = _average(
            weekday_transaction_values
        )

        if (
            predicted_transactions <= 0
            and financial_rates[
                "average_transaction_value"
            ] > 0
        ):
            predicted_transactions = (
                predicted_net_sales
                / financial_rates[
                    "average_transaction_value"
                ]
            )

        weekday_deviation = _standard_deviation(
            weekday_values
        )

        deviation = (
            weekday_deviation
            if weekday_deviation > 0
            else global_deviation
        )

        if deviation <= 0:
            deviation = max(
                1.0,
                predicted_net_sales
                * 0.15,
            )

        sample_size = max(
            1,
            len(
                weekday_values
            ),
        )

        uncertainty = (
            confidence_z_score
            * deviation
            / sqrt(
                max(
                    1.0,
                    sample_size * 0.50,
                )
            )
        )

        lower_bound = max(
            0.0,
            predicted_net_sales
            - uncertainty,
        )

        upper_bound = max(
            predicted_net_sales,
            predicted_net_sales
            + uncertainty,
        )

        channel_forecasts = _daily_channel_forecasts(
            predicted_net_sales,
            channel_metrics,
            weekday_values,
        )

        category_forecasts = _daily_category_forecasts(
            predicted_net_sales,
            category_metrics,
            weekday_values,
        )

        channel_sales = {
            forecast.channel:
                forecast.predicted_net_sales
            for forecast in channel_forecasts
        }

        relative_sales = _rate(
            predicted_net_sales,
            baseline_daily_average,
            1.0,
        )

        gross_margin = _rate(
            predicted_gross_profit,
            predicted_net_sales,
        )

        daily_growth_rate = _growth_rate(
            predicted_net_sales,
            historical_weekday_average,
        )

        explanation = (
            f"{forecast_date.strftime('%A')} sales use "
            f"a historical weekday average of "
            f"{_currency(historical_weekday_average)}, "
            f"a recent trend adjustment of "
            f"{_percentage(overall_growth_rate)}, "
            f"and a scenario adjustment of "
            f"{_percentage(settings.scenario_adjustment)}."
        )

        raw_forecasts.append({
            "forecast_date": forecast_date,
            "day_name": forecast_date.strftime(
                "%A"
            ),
            "is_business_day": True,
            "predicted_gross_sales": _money(
                predicted_gross_sales
            ),
            "predicted_discounts": _money(
                predicted_discounts
            ),
            "predicted_refunds": _money(
                predicted_refunds
            ),
            "predicted_net_sales": _money(
                predicted_net_sales
            ),
            "predicted_collected_sales": _money(
                predicted_collected_sales
            ),
            "predicted_cost_of_goods": _money(
                predicted_cost_of_goods
            ),
            "predicted_gross_profit": _money(
                predicted_gross_profit
            ),
            "predicted_transactions": _quantity(
                predicted_transactions
            ),
            "predicted_service_sales": _money(
                channel_sales.get(
                    "services",
                    0,
                )
            ),
            "predicted_retail_sales": _money(
                channel_sales.get(
                    "retail",
                    0,
                )
            ),
            "predicted_membership_sales": _money(
                channel_sales.get(
                    "memberships",
                    0,
                )
            ),
            "predicted_gift_card_sales": _money(
                channel_sales.get(
                    "gift_cards",
                    0,
                )
            ),
            "predicted_other_sales": _money(
                channel_sales.get(
                    "other",
                    0,
                )
            ),
            "lower_bound": _money(
                lower_bound
            ),
            "upper_bound": _money(
                upper_bound
            ),
            "expected_growth_rate": round(
                daily_growth_rate,
                6,
            ),
            "trend": _trend(
                daily_growth_rate
            ),
            "sales_risk": _sales_risk(
                daily_growth_rate,
                financial_rates["discount_rate"],
                financial_rates["refund_rate"],
                gross_margin,
                relative_sales,
            ),
            "is_peak_day": False,
            "is_quiet_day": False,
            "channel_forecasts": channel_forecasts,
            "category_forecasts": category_forecasts,
            "explanation": explanation,
        })

    business_forecast_values = [
        item["predicted_net_sales"]
        for item in raw_forecasts
        if item["is_business_day"]
    ]

    forecast_average = _average(
        business_forecast_values
    )

    forecast_deviation = _standard_deviation(
        business_forecast_values
    )

    peak_threshold = (
        forecast_average
        + (
            forecast_deviation
            * 0.60
        )
    )

    quiet_threshold = max(
        0.0,
        forecast_average
        - (
            forecast_deviation
            * 0.60
        ),
    )

    if (
        forecast_deviation <= 0
        and business_forecast_values
    ):
        peak_threshold = max(
            business_forecast_values
        )

        quiet_threshold = min(
            business_forecast_values
        )

    for item in raw_forecasts:
        if not item[
            "is_business_day"
        ]:
            continue

        item["is_peak_day"] = (
            item[
                "predicted_net_sales"
            ]
            >= peak_threshold
            and item[
                "predicted_net_sales"
            ] > 0
        )

        item["is_quiet_day"] = (
            item[
                "predicted_net_sales"
            ]
            <= quiet_threshold
            and item[
                "predicted_net_sales"
            ] > 0
        )

    business_items = [
        item
        for item in raw_forecasts
        if (
            item["is_business_day"]
            and item["predicted_net_sales"] > 0
        )
    ]

    if business_items:
        has_peak_day = any(
            item["is_peak_day"]
            for item in business_items
        )

        if not has_peak_day:
            highest_sales = max(
                item["predicted_net_sales"]
                for item in business_items
            )

            peak_candidate = next(
                item
                for item in business_items
                if (
                    item["predicted_net_sales"]
                    == highest_sales
                )
            )

            peak_candidate["is_peak_day"] = True

        has_quiet_day = any(
            item["is_quiet_day"]
            for item in business_items
        )

        if not has_quiet_day:
            lowest_sales = min(
                item["predicted_net_sales"]
                for item in business_items
            )

            quiet_candidates = [
                item
                for item in business_items
                if (
                    item["predicted_net_sales"]
                    == lowest_sales
                    and not item["is_peak_day"]
                )
            ]

            if not quiet_candidates:
                quiet_candidates = [
                    item
                    for item in reversed(
                        business_items
                    )
                    if not item["is_peak_day"]
                ]

            if not quiet_candidates:
                quiet_candidates = [
                    business_items[-1]
                ]

            quiet_candidates[0]["is_quiet_day"] = True

    forecasts = [
        DailySalesForecast(
            **item
        )
        for item in raw_forecasts
    ]

    business_forecasts = [
        item
        for item in forecasts
        if item.is_business_day
    ]

    total_gross_sales = sum(
        item.predicted_gross_sales
        for item in business_forecasts
    )

    total_discounts = sum(
        item.predicted_discounts
        for item in business_forecasts
    )

    total_refunds = sum(
        item.predicted_refunds
        for item in business_forecasts
    )

    total_net_sales = sum(
        item.predicted_net_sales
        for item in business_forecasts
    )

    total_collected_sales = sum(
        item.predicted_collected_sales
        for item in business_forecasts
    )

    total_cost_of_goods = sum(
        item.predicted_cost_of_goods
        for item in business_forecasts
    )

    total_gross_profit = sum(
        item.predicted_gross_profit
        for item in business_forecasts
    )

    total_transactions = sum(
        item.predicted_transactions
        for item in business_forecasts
    )

    total_service_sales = sum(
        item.predicted_service_sales
        for item in business_forecasts
    )

    total_retail_sales = sum(
        item.predicted_retail_sales
        for item in business_forecasts
    )

    total_membership_sales = sum(
        item.predicted_membership_sales
        for item in business_forecasts
    )

    total_gift_card_sales = sum(
        item.predicted_gift_card_sales
        for item in business_forecasts
    )

    total_other_sales = sum(
        item.predicted_other_sales
        for item in business_forecasts
    )

    forecast_growth_rate = _growth_rate(
        _average(
            [
                item.predicted_net_sales
                for item in business_forecasts
            ]
        ),
        baseline_daily_average,
    )

    predicted_discount_rate = _rate(
        total_discounts,
        total_gross_sales,
    )

    predicted_refund_rate = _rate(
        total_refunds,
        total_gross_sales,
    )

    predicted_gross_margin = _rate(
        total_gross_profit,
        total_net_sales,
    )

    collection_rate = _rate(
        total_collected_sales,
        total_net_sales,
        1.0,
    )

    summary = SalesForecastSummary(
        total_predicted_gross_sales=_money(
            total_gross_sales
        ),
        total_predicted_net_sales=_money(
            total_net_sales
        ),
        total_predicted_collected_sales=_money(
            total_collected_sales
        ),
        total_predicted_service_sales=_money(
            total_service_sales
        ),
        total_predicted_retail_sales=_money(
            total_retail_sales
        ),
        total_predicted_membership_sales=_money(
            total_membership_sales
        ),
        total_predicted_gift_card_sales=_money(
            total_gift_card_sales
        ),
        total_predicted_other_sales=_money(
            total_other_sales
        ),
        total_predicted_cost_of_goods=_money(
            total_cost_of_goods
        ),
        total_predicted_gross_profit=_money(
            total_gross_profit
        ),
        total_predicted_transactions=_quantity(
            total_transactions
        ),
        average_daily_net_sales=_money(
            _average(
                [
                    item.predicted_net_sales
                    for item in business_forecasts
                ]
            )
        ),
        average_transaction_value=_money(
            _rate(
                total_net_sales,
                total_transactions,
            )
        ),
        expected_growth_rate=round(
            forecast_growth_rate,
            6,
        ),
        predicted_discount_rate=round(
            _clamp(
                predicted_discount_rate,
                0.0,
                1.0,
            ),
            6,
        ),
        predicted_refund_rate=round(
            _clamp(
                predicted_refund_rate,
                0.0,
                1.0,
            ),
            6,
        ),
        predicted_gross_margin=round(
            _clamp(
                predicted_gross_margin,
                0.0,
                1.0,
            ),
            6,
        ),
        peak_dates=[
            item.forecast_date
            for item in business_forecasts
            if item.is_peak_day
        ],
        quiet_dates=[
            item.forecast_date
            for item in business_forecasts
            if item.is_quiet_day
        ],
        channel_insights=_channel_insights(
            channel_metrics
        ),
        category_insights=_category_insights(
            category_metrics
        ),
        risk_alerts=_risk_alerts(
            forecast_growth_rate,
            predicted_discount_rate,
            predicted_refund_rate,
            predicted_gross_margin,
            collection_rate,
        ),
        data_quality_warnings=_data_quality_warnings(
            payload,
            all_business,
            category_metrics,
            financial_rates,
        ),
    )

    return SalesForecastResponse(
        generated_at=datetime.now(
            timezone.utc
        ),
        as_of_date=payload.as_of_date,
        forecast_start=forecast_start,
        forecast_end=(
            forecast_start
            + timedelta(
                days=(
                    settings.horizon_days
                    - 1
                )
            )
        ),
        summary=summary,
        forecasts=forecasts,
        monthly_forecasts=_monthly_forecasts(
            forecasts
        ),
        metadata=ServiceMetadata(
            model_name=MODEL_NAME,
            provider_mode=provider_mode,
            rules_applied=RULES_APPLIED,
        ),
    )


def build_ai_sales_forecast(
    payload: SalesForecastRequest,
    provider_mode: str = "mock",
) -> SalesForecastResponse:
    return build_sales_forecast(
        payload,
        provider_mode=provider_mode,
    )


__all__ = [
    "MODEL_NAME",
    "RULES_APPLIED",
    "build_ai_sales_forecast",
    "build_sales_forecast",
]