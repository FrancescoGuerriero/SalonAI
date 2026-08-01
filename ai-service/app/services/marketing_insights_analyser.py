from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from statistics import fmean
from typing import Iterable

from app.schemas.common import ServiceMetadata
from app.schemas.marketing_insights import (
    CampaignMarketingInsight,
    CampaignObservation,
    ChannelMarketingInsight,
    DailyMarketingObservation,
    MarketingInsight,
    MarketingInsightsRequest,
    MarketingInsightsResponse,
    MarketingInsightsSummary,
    MarketingRateMetrics,
    MarketingValueMetrics,
)


MODEL_NAME = (
    "salonai-marketing-insights-rules-v1"
)

RULES_APPLIED = [
    "delivery-performance",
    "engagement-rates",
    "booking-conversion",
    "completed-appointment-conversion",
    "customer-acquisition",
    "revenue-attribution",
    "return-on-marketing-spend",
    "campaign-performance-scoring",
    "channel-performance-ranking",
    "recent-versus-baseline-trends",
    "risk-detection",
    "recommended-actions",
]


CHANNEL_LABELS = {
    "email": "Email",
    "sms": "SMS",
    "whatsapp": "WhatsApp",
    "push": "Push notifications",
    "social": "Social media",
    "referral": "Referrals",
    "organic": "Organic",
    "paid_search": "Paid search",
    "paid_social": "Paid social",
    "other": "Other",
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
    return max(
        0.0,
        _number(value),
    )


def _money(
    value: float | int | None,
) -> float:
    return round(
        _positive(value),
        2,
    )


def _quantity(
    value: float | int | None,
) -> int:
    return max(
        0,
        int(
            round(
                _positive(value)
            )
        ),
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
    value: float,
) -> str:
    if value >= 0.05:
        return "rising"

    if value <= -0.05:
        return "falling"

    return "stable"


def _percentage(
    value: float,
) -> str:
    return f"{value * 100:.1f}%"


def _currency(
    value: float,
) -> str:
    return f"£{value:,.2f}"


def _confidence(
    sample_size: int,
    activity_volume: float,
) -> float:
    sample_component = min(
        0.30,
        sample_size / 300,
    )

    volume_component = min(
        0.20,
        activity_volume / 10_000,
    )

    return round(
        _clamp(
            0.45
            + sample_component
            + volume_component,
            0.35,
            0.95,
        ),
        4,
    )


def _aggregate_rate_metrics(
    *,
    messages_sent: float,
    messages_delivered: float,
    messages_opened: float,
    messages_clicked: float,
    bookings: float,
    completed_appointments: float,
    new_customers: float,
    unsubscribes: float,
    failed_deliveries: float,
) -> MarketingRateMetrics:
    return MarketingRateMetrics(
        delivery_rate=round(
            _clamp(
                _rate(
                    messages_delivered,
                    messages_sent,
                ),
                0.0,
                1.0,
            ),
            6,
        ),
        open_rate=round(
            _clamp(
                _rate(
                    messages_opened,
                    messages_delivered,
                ),
                0.0,
                1.0,
            ),
            6,
        ),
        click_rate=round(
            _clamp(
                _rate(
                    messages_clicked,
                    messages_delivered,
                ),
                0.0,
                1.0,
            ),
            6,
        ),
        click_to_open_rate=round(
            _clamp(
                _rate(
                    messages_clicked,
                    messages_opened,
                ),
                0.0,
                1.0,
            ),
            6,
        ),
        booking_conversion_rate=round(
            _clamp(
                _rate(
                    bookings,
                    messages_delivered,
                ),
                0.0,
                1.0,
            ),
            6,
        ),
        completed_conversion_rate=round(
            _clamp(
                _rate(
                    completed_appointments,
                    messages_delivered,
                ),
                0.0,
                1.0,
            ),
            6,
        ),
        unsubscribe_rate=round(
            _clamp(
                _rate(
                    unsubscribes,
                    messages_delivered,
                ),
                0.0,
                1.0,
            ),
            6,
        ),
        failure_rate=round(
            _clamp(
                _rate(
                    failed_deliveries,
                    messages_sent,
                ),
                0.0,
                1.0,
            ),
            6,
        ),
        new_customer_rate=round(
            _clamp(
                _rate(
                    new_customers,
                    completed_appointments,
                ),
                0.0,
                1.0,
            ),
            6,
        ),
    )


def _aggregate_value_metrics(
    *,
    marketing_cost: float,
    attributed_revenue: float,
    discounts_redeemed: float,
    refunds: float,
    bookings: float,
    completed_appointments: float,
    messages_sent: float,
) -> MarketingValueMetrics:
    net_attributed_revenue = max(
        0.0,
        attributed_revenue
        - discounts_redeemed
        - refunds,
    )

    return MarketingValueMetrics(
        marketing_cost=_money(
            marketing_cost
        ),
        attributed_revenue=_money(
            attributed_revenue
        ),
        net_attributed_revenue=_money(
            net_attributed_revenue
        ),
        return_on_marketing_spend=round(
            _rate(
                net_attributed_revenue,
                marketing_cost,
            ),
            4,
        ),
        cost_per_booking=_money(
            _rate(
                marketing_cost,
                bookings,
            )
        ),
        cost_per_completed_appointment=_money(
            _rate(
                marketing_cost,
                completed_appointments,
            )
        ),
        revenue_per_message=_money(
            _rate(
                net_attributed_revenue,
                messages_sent,
            )
        ),
        revenue_per_booking=_money(
            _rate(
                net_attributed_revenue,
                bookings,
            )
        ),
    )


def _window(
    observations: list[
        DailyMarketingObservation
    ],
    days: int,
) -> list[
    DailyMarketingObservation
]:
    if days <= 0:
        return []

    return observations[-days:]


def _daily_totals(
    observations: list[
        DailyMarketingObservation
    ],
) -> dict[str, float]:
    fields = (
        "active_customers",
        "new_customers",
        "returning_customers",
        "enquiries",
        "bookings",
        "completed_appointments",
        "cancelled_appointments",
        "no_show_appointments",
        "messages_sent",
        "messages_delivered",
        "messages_opened",
        "messages_clicked",
        "unsubscribes",
        "failed_deliveries",
        "marketing_cost",
        "attributed_revenue",
        "total_revenue",
        "discounts_redeemed",
        "refunds",
    )

    result = {
        field: 0.0
        for field in fields
    }

    for observation in observations:
        for field in fields:
            result[field] += _positive(
                getattr(
                    observation,
                    field,
                    0,
                )
            )

    return result


def _daily_average(
    observations: list[
        DailyMarketingObservation
    ],
    field: str,
) -> float:
    return _average(
        [
            _positive(
                getattr(
                    observation,
                    field,
                    0,
                )
            )
            for observation in observations
        ]
    )


def _channel_totals(
    observations: list[
        DailyMarketingObservation
    ],
) -> dict[str, dict[str, float]]:
    result: dict[
        str,
        dict[str, float]
    ] = defaultdict(
        lambda: defaultdict(float)
    )

    fields = (
        "audience_size",
        "messages_sent",
        "messages_delivered",
        "messages_opened",
        "messages_clicked",
        "enquiries",
        "bookings",
        "completed_appointments",
        "new_customers",
        "returning_customers",
        "unsubscribes",
        "failed_deliveries",
        "marketing_cost",
        "attributed_revenue",
        "discounts_redeemed",
        "refunds",
    )

    for observation in observations:
        for channel in observation.channels:
            target = result[
                channel.channel
            ]

            target["records"] += 1

            for field in fields:
                target[field] += _positive(
                    getattr(
                        channel,
                        field,
                        0,
                    )
                )

    return {
        key: dict(value)
        for key, value in result.items()
    }


def _campaign_totals(
    observations: list[
        DailyMarketingObservation
    ],
) -> dict[str, dict]:
    result: dict[str, dict] = {}

    numeric_fields = (
        "audience_size",
        "messages_sent",
        "messages_delivered",
        "messages_opened",
        "messages_clicked",
        "bookings",
        "completed_appointments",
        "new_customers",
        "returning_customers",
        "unsubscribes",
        "failed_deliveries",
        "marketing_cost",
        "attributed_revenue",
        "discounts_redeemed",
        "refunds",
    )

    for observation in observations:
        for campaign in observation.campaigns:
            key = campaign.campaign_key

            if key not in result:
                result[key] = {
                    "campaign_key": key,
                    "campaign_name":
                        campaign.campaign_name,
                    "channel":
                        campaign.channel,
                    "status":
                        campaign.status,
                    "audience_segment":
                        campaign.audience_segment,
                    "started_on":
                        campaign.started_on,
                    "ended_on":
                        campaign.ended_on,
                    "records": 0,
                }

                for field in numeric_fields:
                    result[key][field] = 0.0

            target = result[key]

            target["records"] += 1
            target["campaign_name"] = (
                campaign.campaign_name
            )
            target["channel"] = (
                campaign.channel
            )
            target["status"] = (
                campaign.status
            )

            if campaign.audience_segment:
                target["audience_segment"] = (
                    campaign.audience_segment
                )

            if campaign.started_on:
                existing = target[
                    "started_on"
                ]

                target["started_on"] = (
                    campaign.started_on
                    if existing is None
                    else min(
                        existing,
                        campaign.started_on,
                    )
                )

            if campaign.ended_on:
                existing = target[
                    "ended_on"
                ]

                target["ended_on"] = (
                    campaign.ended_on
                    if existing is None
                    else max(
                        existing,
                        campaign.ended_on,
                    )
                )

            for field in numeric_fields:
                target[field] += _positive(
                    getattr(
                        campaign,
                        field,
                        0,
                    )
                )

    return result


def _channel_risk(
    rates: MarketingRateMetrics,
    value: MarketingValueMetrics,
    settings,
) -> str:
    if (
        rates.failure_rate
        >= settings.high_failure_rate
        or rates.unsubscribe_rate
        >= settings.high_unsubscribe_rate
    ):
        return "high"

    if (
        rates.delivery_rate < 0.85
        or rates.booking_conversion_rate
        < settings.strong_conversion_rate
        / 2
        or (
            value.marketing_cost > 0
            and value.return_on_marketing_spend < 1
        )
    ):
        return "medium"

    if (
        rates.booking_conversion_rate
        >= settings.strong_conversion_rate
        and (
            value.marketing_cost == 0
            or value.return_on_marketing_spend >= 2
        )
    ):
        return "balanced"

    return "low"


def _strengths_and_weaknesses(
    rates: MarketingRateMetrics,
    value: MarketingValueMetrics,
    settings,
) -> tuple[
    list[str],
    list[str],
]:
    strengths: list[str] = []
    weaknesses: list[str] = []

    if (
        rates.delivery_rate
        >= 0.95
    ):
        strengths.append(
            "Strong delivery performance."
        )

    if (
        rates.open_rate
        >= settings.strong_open_rate
    ):
        strengths.append(
            "Open rate is above the strong-performance threshold."
        )

    if (
        rates.click_rate
        >= settings.strong_click_rate
    ):
        strengths.append(
            "Click rate indicates strong engagement."
        )

    if (
        rates.booking_conversion_rate
        >= settings.strong_conversion_rate
    ):
        strengths.append(
            "Booking conversion is performing strongly."
        )

    if (
        value.marketing_cost > 0
        and value.return_on_marketing_spend
        >= 3
    ):
        strengths.append(
            "Marketing spend is producing a strong revenue return."
        )

    if (
        rates.delivery_rate
        < 0.85
    ):
        weaknesses.append(
            "Delivery performance is below the recommended level."
        )

    if (
        rates.open_rate
        < settings.strong_open_rate
        / 2
        and rates.messages_sent > 0
    ):
        weaknesses.append(
            "Open rate is materially below the target level."
        )

    if (
        rates.click_rate
        < settings.strong_click_rate
        / 2
        and rates.messages_sent > 0
    ):
        weaknesses.append(
            "Click-through engagement is weak."
        )

    if (
        rates.booking_conversion_rate
        < settings.strong_conversion_rate
        / 2
        and rates.messages_sent > 0
    ):
        weaknesses.append(
            "Message delivery is not converting effectively into bookings."
        )

    if (
        rates.unsubscribe_rate
        >= settings.high_unsubscribe_rate
    ):
        weaknesses.append(
            "Unsubscribe rate is above the configured risk threshold."
        )

    if (
        rates.failure_rate
        >= settings.high_failure_rate
    ):
        weaknesses.append(
            "Delivery failures are above the configured risk threshold."
        )

    if (
        value.marketing_cost > 0
        and value.return_on_marketing_spend
        < 1
    ):
        weaknesses.append(
            "Attributed revenue does not currently cover marketing spend."
        )

    return (
        strengths[:10],
        weaknesses[:10],
    )


def _performance_score(
    rates: MarketingRateMetrics,
    value: MarketingValueMetrics,
    settings,
) -> float:
    delivery_score = min(
        1.0,
        _rate(
            rates.delivery_rate,
            0.95,
        ),
    )

    open_score = min(
        1.0,
        _rate(
            rates.open_rate,
            settings.strong_open_rate,
        ),
    )

    click_score = min(
        1.0,
        _rate(
            rates.click_rate,
            settings.strong_click_rate,
        ),
    )

    conversion_score = min(
        1.0,
        _rate(
            rates.booking_conversion_rate,
            settings.strong_conversion_rate,
        ),
    )

    revenue_score = min(
        1.0,
        _rate(
            value.return_on_marketing_spend,
            3.0,
        ),
    )

    risk_penalty = (
        min(
            0.20,
            rates.failure_rate,
        )
        +
        min(
            0.20,
            rates.unsubscribe_rate
            * 2,
        )
    )

    weighted_score = (
        delivery_score * 0.15
        + open_score * 0.15
        + click_score * 0.20
        + conversion_score * 0.30
        + revenue_score * 0.20
        - risk_penalty
    )

    return round(
        _clamp(
            weighted_score * 100,
            0.0,
            100.0,
        ),
        2,
    )


def _build_channel_insights(
    baseline: dict[
        str,
        dict[str, float]
    ],
    recent: dict[
        str,
        dict[str, float]
    ],
    settings,
) -> list[
    ChannelMarketingInsight
]:
    insights: list[
        ChannelMarketingInsight
    ] = []

    for channel, totals in baseline.items():
        if (
            totals.get(
                "messages_sent",
                0,
            )
            <
            settings.minimum_channel_messages
        ):
            continue

        recent_totals = recent.get(
            channel,
            {},
        )

        rates = _aggregate_rate_metrics(
            messages_sent=totals.get(
                "messages_sent",
                0,
            ),
            messages_delivered=totals.get(
                "messages_delivered",
                0,
            ),
            messages_opened=totals.get(
                "messages_opened",
                0,
            ),
            messages_clicked=totals.get(
                "messages_clicked",
                0,
            ),
            bookings=totals.get(
                "bookings",
                0,
            ),
            completed_appointments=totals.get(
                "completed_appointments",
                0,
            ),
            new_customers=totals.get(
                "new_customers",
                0,
            ),
            unsubscribes=totals.get(
                "unsubscribes",
                0,
            ),
            failed_deliveries=totals.get(
                "failed_deliveries",
                0,
            ),
        )

        value = _aggregate_value_metrics(
            marketing_cost=totals.get(
                "marketing_cost",
                0,
            ),
            attributed_revenue=totals.get(
                "attributed_revenue",
                0,
            ),
            discounts_redeemed=totals.get(
                "discounts_redeemed",
                0,
            ),
            refunds=totals.get(
                "refunds",
                0,
            ),
            bookings=totals.get(
                "bookings",
                0,
            ),
            completed_appointments=totals.get(
                "completed_appointments",
                0,
            ),
            messages_sent=totals.get(
                "messages_sent",
                0,
            ),
        )

        baseline_open_rate = rates.open_rate
        baseline_conversion_rate = (
            rates.booking_conversion_rate
        )
        baseline_revenue_per_message = (
            value.revenue_per_message
        )

        recent_rates = _aggregate_rate_metrics(
            messages_sent=recent_totals.get(
                "messages_sent",
                0,
            ),
            messages_delivered=recent_totals.get(
                "messages_delivered",
                0,
            ),
            messages_opened=recent_totals.get(
                "messages_opened",
                0,
            ),
            messages_clicked=recent_totals.get(
                "messages_clicked",
                0,
            ),
            bookings=recent_totals.get(
                "bookings",
                0,
            ),
            completed_appointments=recent_totals.get(
                "completed_appointments",
                0,
            ),
            new_customers=recent_totals.get(
                "new_customers",
                0,
            ),
            unsubscribes=recent_totals.get(
                "unsubscribes",
                0,
            ),
            failed_deliveries=recent_totals.get(
                "failed_deliveries",
                0,
            ),
        )

        recent_value = _aggregate_value_metrics(
            marketing_cost=recent_totals.get(
                "marketing_cost",
                0,
            ),
            attributed_revenue=recent_totals.get(
                "attributed_revenue",
                0,
            ),
            discounts_redeemed=recent_totals.get(
                "discounts_redeemed",
                0,
            ),
            refunds=recent_totals.get(
                "refunds",
                0,
            ),
            bookings=recent_totals.get(
                "bookings",
                0,
            ),
            completed_appointments=recent_totals.get(
                "completed_appointments",
                0,
            ),
            messages_sent=recent_totals.get(
                "messages_sent",
                0,
            ),
        )

        strengths, weaknesses = (
            _strengths_and_weaknesses(
                rates,
                value,
                settings,
            )
        )

        insights.append(
            ChannelMarketingInsight(
                channel=channel,
                audience_size=_quantity(
                    totals.get(
                        "audience_size",
                        0,
                    )
                ),
                messages_sent=_quantity(
                    totals.get(
                        "messages_sent",
                        0,
                    )
                ),
                messages_delivered=_quantity(
                    totals.get(
                        "messages_delivered",
                        0,
                    )
                ),
                messages_opened=_quantity(
                    totals.get(
                        "messages_opened",
                        0,
                    )
                ),
                messages_clicked=_quantity(
                    totals.get(
                        "messages_clicked",
                        0,
                    )
                ),
                bookings=_quantity(
                    totals.get(
                        "bookings",
                        0,
                    )
                ),
                completed_appointments=_quantity(
                    totals.get(
                        "completed_appointments",
                        0,
                    )
                ),
                new_customers=_quantity(
                    totals.get(
                        "new_customers",
                        0,
                    )
                ),
                rates=rates,
                value=value,
                engagement_trend=_trend(
                    _growth_rate(
                        recent_rates.open_rate,
                        baseline_open_rate,
                    )
                ),
                conversion_trend=_trend(
                    _growth_rate(
                        recent_rates.booking_conversion_rate,
                        baseline_conversion_rate,
                    )
                ),
                revenue_trend=_trend(
                    _growth_rate(
                        recent_value.revenue_per_message,
                        baseline_revenue_per_message,
                    )
                ),
                risk=_channel_risk(
                    rates,
                    value,
                    settings,
                ),
                confidence=_confidence(
                    int(
                        totals.get(
                            "records",
                            0,
                        )
                    ),
                    totals.get(
                        "messages_sent",
                        0,
                    ),
                ),
                strengths=strengths,
                weaknesses=weaknesses,
            )
        )

    return sorted(
        insights,
        key=lambda item: (
            item.value.net_attributed_revenue,
            item.rates.booking_conversion_rate,
        ),
        reverse=True,
    )


def _build_campaign_insights(
    baseline: dict[
        str,
        dict
    ],
    recent: dict[
        str,
        dict
    ],
    settings,
) -> list[
    CampaignMarketingInsight
]:
    insights: list[
        CampaignMarketingInsight
    ] = []

    for key, totals in baseline.items():
        if (
            totals.get(
                "messages_sent",
                0,
            )
            <
            settings.minimum_campaign_messages
        ):
            continue

        rates = _aggregate_rate_metrics(
            messages_sent=totals.get(
                "messages_sent",
                0,
            ),
            messages_delivered=totals.get(
                "messages_delivered",
                0,
            ),
            messages_opened=totals.get(
                "messages_opened",
                0,
            ),
            messages_clicked=totals.get(
                "messages_clicked",
                0,
            ),
            bookings=totals.get(
                "bookings",
                0,
            ),
            completed_appointments=totals.get(
                "completed_appointments",
                0,
            ),
            new_customers=totals.get(
                "new_customers",
                0,
            ),
            unsubscribes=totals.get(
                "unsubscribes",
                0,
            ),
            failed_deliveries=totals.get(
                "failed_deliveries",
                0,
            ),
        )

        value = _aggregate_value_metrics(
            marketing_cost=totals.get(
                "marketing_cost",
                0,
            ),
            attributed_revenue=totals.get(
                "attributed_revenue",
                0,
            ),
            discounts_redeemed=totals.get(
                "discounts_redeemed",
                0,
            ),
            refunds=totals.get(
                "refunds",
                0,
            ),
            bookings=totals.get(
                "bookings",
                0,
            ),
            completed_appointments=totals.get(
                "completed_appointments",
                0,
            ),
            messages_sent=totals.get(
                "messages_sent",
                0,
            ),
        )

        recent_totals = recent.get(
            key,
            {},
        )

        recent_rates = _aggregate_rate_metrics(
            messages_sent=recent_totals.get(
                "messages_sent",
                0,
            ),
            messages_delivered=recent_totals.get(
                "messages_delivered",
                0,
            ),
            messages_opened=recent_totals.get(
                "messages_opened",
                0,
            ),
            messages_clicked=recent_totals.get(
                "messages_clicked",
                0,
            ),
            bookings=recent_totals.get(
                "bookings",
                0,
            ),
            completed_appointments=recent_totals.get(
                "completed_appointments",
                0,
            ),
            new_customers=recent_totals.get(
                "new_customers",
                0,
            ),
            unsubscribes=recent_totals.get(
                "unsubscribes",
                0,
            ),
            failed_deliveries=recent_totals.get(
                "failed_deliveries",
                0,
            ),
        )

        strengths, weaknesses = (
            _strengths_and_weaknesses(
                rates,
                value,
                settings,
            )
        )

        insights.append(
            CampaignMarketingInsight(
                campaign_key=key,
                campaign_name=totals[
                    "campaign_name"
                ],
                channel=totals[
                    "channel"
                ],
                status=totals[
                    "status"
                ],
                audience_segment=totals.get(
                    "audience_segment"
                ),
                started_on=totals.get(
                    "started_on"
                ),
                ended_on=totals.get(
                    "ended_on"
                ),
                audience_size=_quantity(
                    totals.get(
                        "audience_size",
                        0,
                    )
                ),
                messages_sent=_quantity(
                    totals.get(
                        "messages_sent",
                        0,
                    )
                ),
                bookings=_quantity(
                    totals.get(
                        "bookings",
                        0,
                    )
                ),
                completed_appointments=_quantity(
                    totals.get(
                        "completed_appointments",
                        0,
                    )
                ),
                new_customers=_quantity(
                    totals.get(
                        "new_customers",
                        0,
                    )
                ),
                rates=rates,
                value=value,
                performance_score=_performance_score(
                    rates,
                    value,
                    settings,
                ),
                trend=_trend(
                    _growth_rate(
                        recent_rates.booking_conversion_rate,
                        rates.booking_conversion_rate,
                    )
                ),
                risk=_channel_risk(
                    rates,
                    value,
                    settings,
                ),
                confidence=_confidence(
                    int(
                        totals.get(
                            "records",
                            0,
                        )
                    ),
                    totals.get(
                        "messages_sent",
                        0,
                    ),
                ),
                strengths=strengths,
                weaknesses=weaknesses,
            )
        )

    return sorted(
        insights,
        key=lambda item: (
            item.performance_score,
            item.value.net_attributed_revenue,
        ),
        reverse=True,
    )


def _overall_risk(
    rates: MarketingRateMetrics,
    value: MarketingValueMetrics,
    settings,
) -> str:
    if (
        rates.failure_rate
        >= settings.high_failure_rate
        or rates.unsubscribe_rate
        >= settings.high_unsubscribe_rate
        or (
            value.marketing_cost > 0
            and value.return_on_marketing_spend < 0.75
        )
    ):
        return "high"

    if (
        rates.delivery_rate < 0.90
        or rates.booking_conversion_rate
        < settings.strong_conversion_rate / 2
        or (
            value.marketing_cost > 0
            and value.return_on_marketing_spend < 1.5
        )
    ):
        return "medium"

    if (
        rates.booking_conversion_rate
        >= settings.strong_conversion_rate
        and (
            value.marketing_cost == 0
            or value.return_on_marketing_spend >= 2
        )
    ):
        return "balanced"

    return "low"


def _risk_alerts(
    rates: MarketingRateMetrics,
    value: MarketingValueMetrics,
    settings,
) -> list[str]:
    alerts: list[str] = []

    if (
        rates.failure_rate
        >= settings.high_failure_rate
    ):
        alerts.append(
            (
                "Delivery failures are "
                f"{_percentage(rates.failure_rate)}, "
                "above the configured threshold."
            )
        )

    if (
        rates.unsubscribe_rate
        >= settings.high_unsubscribe_rate
    ):
        alerts.append(
            (
                "Unsubscribe rate is "
                f"{_percentage(rates.unsubscribe_rate)}, "
                "which may indicate audience fatigue or targeting issues."
            )
        )

    if (
        rates.booking_conversion_rate
        <
        settings.strong_conversion_rate
        / 2
    ):
        alerts.append(
            (
                "Booking conversion is materially below "
                "the configured strong-performance threshold."
            )
        )

    if (
        value.marketing_cost > 0
        and value.return_on_marketing_spend < 1
    ):
        alerts.append(
            (
                "Attributed revenue is currently below "
                "marketing spend."
            )
        )

    return alerts


def _data_quality_warnings(
    payload: MarketingInsightsRequest,
    totals: dict[str, float],
    channels: list[
        ChannelMarketingInsight
    ],
    campaigns: list[
        CampaignMarketingInsight
    ],
) -> list[str]:
    warnings: list[str] = []

    if (
        len(payload.observations)
        <
        payload.settings.minimum_history_days
    ):
        warnings.append(
            (
                "The supplied observation history is shorter "
                "than the configured minimum history period."
            )
        )

    if (
        totals["messages_sent"] <= 0
    ):
        warnings.append(
            (
                "No outbound message activity was supplied, "
                "so engagement analysis is limited."
            )
        )

    if (
        totals["attributed_revenue"] <= 0
    ):
        warnings.append(
            (
                "No attributed marketing revenue was supplied, "
                "so revenue-efficiency metrics may be incomplete."
            )
        )

    if (
        payload.settings.include_channel_insights
        and not channels
    ):
        warnings.append(
            (
                "No channel met the configured minimum message volume."
            )
        )

    if (
        payload.settings.include_campaign_insights
        and not campaigns
    ):
        warnings.append(
            (
                "No campaign met the configured minimum message volume."
            )
        )

    if not warnings:
        warnings.append(
            (
                "No material data-quality issues were detected "
                "in the supplied aggregate marketing history."
            )
        )

    return warnings


def _marketing_insights(
    summary_rates: MarketingRateMetrics,
    summary_value: MarketingValueMetrics,
    channels: list[
        ChannelMarketingInsight
    ],
    campaigns: list[
        CampaignMarketingInsight
    ],
    settings,
) -> list[
    MarketingInsight
]:
    insights: list[
        MarketingInsight
    ] = []

    if (
        summary_rates.delivery_rate
        < 0.90
    ):
        insights.append(
            MarketingInsight(
                insight_id=(
                    "deliverability-overall"
                ),
                category="deliverability",
                priority="high",
                title=(
                    "Improve message deliverability"
                ),
                description=(
                    "A material share of outbound messages "
                    "is not reaching customers."
                ),
                evidence=[
                    (
                        "Overall delivery rate: "
                        f"{_percentage(summary_rates.delivery_rate)}"
                    ),
                    (
                        "Failure rate: "
                        f"{_percentage(summary_rates.failure_rate)}"
                    ),
                ],
                recommended_action=(
                    "Review invalid contact details, provider failures, "
                    "suppression rules and channel-specific delivery logs."
                ),
                estimated_impact=(
                    "Higher reach without increasing campaign volume."
                ),
            )
        )

    if (
        summary_rates.open_rate
        < settings.strong_open_rate
    ):
        insights.append(
            MarketingInsight(
                insight_id=(
                    "engagement-open-rate"
                ),
                category="engagement",
                priority="medium",
                title=(
                    "Strengthen message open performance"
                ),
                description=(
                    "Overall open performance is below the configured "
                    "strong-engagement threshold."
                ),
                evidence=[
                    (
                        "Open rate: "
                        f"{_percentage(summary_rates.open_rate)}"
                    ),
                    (
                        "Target threshold: "
                        f"{_percentage(settings.strong_open_rate)}"
                    ),
                ],
                recommended_action=(
                    "Test clearer subject lines, improved send timing "
                    "and more specific audience segmentation."
                ),
                estimated_impact=(
                    "More customers entering the booking funnel."
                ),
            )
        )

    if (
        summary_rates.booking_conversion_rate
        < settings.strong_conversion_rate
    ):
        insights.append(
            MarketingInsight(
                insight_id=(
                    "conversion-booking-rate"
                ),
                category="conversion",
                priority="high",
                title=(
                    "Improve booking conversion"
                ),
                description=(
                    "Delivered marketing messages are not converting "
                    "into bookings at the desired rate."
                ),
                evidence=[
                    (
                        "Booking conversion: "
                        f"{_percentage(summary_rates.booking_conversion_rate)}"
                    ),
                    (
                        "Configured target: "
                        f"{_percentage(settings.strong_conversion_rate)}"
                    ),
                ],
                recommended_action=(
                    "Use a clearer booking call-to-action, direct deep links, "
                    "limited-time offers and more relevant service targeting."
                ),
                estimated_impact=(
                    "Higher booking volume from the existing audience."
                ),
            )
        )

    if (
        summary_value.marketing_cost > 0
        and summary_value.return_on_marketing_spend < 1.5
    ):
        insights.append(
            MarketingInsight(
                insight_id=(
                    "revenue-low-roms"
                ),
                category="revenue",
                priority="high",
                title=(
                    "Marketing return requires attention"
                ),
                description=(
                    "Net attributed revenue is producing a weak return "
                    "relative to marketing spend."
                ),
                evidence=[
                    (
                        "Return on marketing spend: "
                        f"{summary_value.return_on_marketing_spend:.2f}x"
                    ),
                    (
                        "Marketing cost: "
                        f"{_currency(summary_value.marketing_cost)}"
                    ),
                    (
                        "Net attributed revenue: "
                        f"{_currency(summary_value.net_attributed_revenue)}"
                    ),
                ],
                recommended_action=(
                    "Reduce spend on low-converting campaigns and reallocate "
                    "budget toward the strongest channels and audience segments."
                ),
                estimated_impact=(
                    "Improved revenue efficiency and lower acquisition cost."
                ),
            )
        )

    if channels:
        best_channel = channels[0]

        insights.append(
            MarketingInsight(
                insight_id=(
                    f"channel-best-{best_channel.channel}"
                ),
                category="channel",
                priority="medium",
                title=(
                    f"{CHANNEL_LABELS.get(best_channel.channel, best_channel.channel)} "
                    "is the strongest current channel"
                ),
                description=(
                    "This channel leads the current ranking based on "
                    "net attributed revenue and booking conversion."
                ),
                evidence=[
                    (
                        "Net attributed revenue: "
                        f"{_currency(best_channel.value.net_attributed_revenue)}"
                    ),
                    (
                        "Booking conversion: "
                        f"{_percentage(best_channel.rates.booking_conversion_rate)}"
                    ),
                ],
                recommended_action=(
                    "Use this channel as the control benchmark for future "
                    "campaign testing and budget allocation."
                ),
                affected_channel=(
                    best_channel.channel
                ),
                estimated_impact=(
                    "Improved consistency across lower-performing channels."
                ),
            )
        )

    if campaigns:
        best_campaign = campaigns[0]

        insights.append(
            MarketingInsight(
                insight_id=(
                    f"campaign-best-{best_campaign.campaign_key}"
                ),
                category="campaign",
                priority="medium",
                title=(
                    f"{best_campaign.campaign_name} is the leading campaign"
                ),
                description=(
                    "This campaign has the highest combined engagement, "
                    "conversion and revenue-efficiency score."
                ),
                evidence=[
                    (
                        "Performance score: "
                        f"{best_campaign.performance_score:.1f}/100"
                    ),
                    (
                        "Booking conversion: "
                        f"{_percentage(best_campaign.rates.booking_conversion_rate)}"
                    ),
                    (
                        "Net attributed revenue: "
                        f"{_currency(best_campaign.value.net_attributed_revenue)}"
                    ),
                ],
                recommended_action=(
                    "Reuse the campaign's targeting, offer structure and "
                    "message format as a reference for future campaigns."
                ),
                affected_channel=(
                    best_campaign.channel
                ),
                affected_campaign_key=(
                    best_campaign.campaign_key
                ),
                estimated_impact=(
                    "Faster optimisation of future campaign performance."
                ),
            )
        )

    return insights[:100]


def build_marketing_insights(
    payload: MarketingInsightsRequest,
    provider_mode: str = "mock",
) -> MarketingInsightsResponse:
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

    totals = _daily_totals(
        baseline_observations
    )

    recent_totals = _daily_totals(
        recent_observations
    )

    summary_rates = _aggregate_rate_metrics(
        messages_sent=totals[
            "messages_sent"
        ],
        messages_delivered=totals[
            "messages_delivered"
        ],
        messages_opened=totals[
            "messages_opened"
        ],
        messages_clicked=totals[
            "messages_clicked"
        ],
        bookings=totals[
            "bookings"
        ],
        completed_appointments=totals[
            "completed_appointments"
        ],
        new_customers=totals[
            "new_customers"
        ],
        unsubscribes=totals[
            "unsubscribes"
        ],
        failed_deliveries=totals[
            "failed_deliveries"
        ],
    )

    summary_value = _aggregate_value_metrics(
        marketing_cost=totals[
            "marketing_cost"
        ],
        attributed_revenue=totals[
            "attributed_revenue"
        ],
        discounts_redeemed=totals[
            "discounts_redeemed"
        ],
        refunds=totals[
            "refunds"
        ],
        bookings=totals[
            "bookings"
        ],
        completed_appointments=totals[
            "completed_appointments"
        ],
        messages_sent=totals[
            "messages_sent"
        ],
    )

    recent_rates = _aggregate_rate_metrics(
        messages_sent=recent_totals[
            "messages_sent"
        ],
        messages_delivered=recent_totals[
            "messages_delivered"
        ],
        messages_opened=recent_totals[
            "messages_opened"
        ],
        messages_clicked=recent_totals[
            "messages_clicked"
        ],
        bookings=recent_totals[
            "bookings"
        ],
        completed_appointments=recent_totals[
            "completed_appointments"
        ],
        new_customers=recent_totals[
            "new_customers"
        ],
        unsubscribes=recent_totals[
            "unsubscribes"
        ],
        failed_deliveries=recent_totals[
            "failed_deliveries"
        ],
    )

    recent_value = _aggregate_value_metrics(
        marketing_cost=recent_totals[
            "marketing_cost"
        ],
        attributed_revenue=recent_totals[
            "attributed_revenue"
        ],
        discounts_redeemed=recent_totals[
            "discounts_redeemed"
        ],
        refunds=recent_totals[
            "refunds"
        ],
        bookings=recent_totals[
            "bookings"
        ],
        completed_appointments=recent_totals[
            "completed_appointments"
        ],
        messages_sent=recent_totals[
            "messages_sent"
        ],
    )

    channel_insights = (
        _build_channel_insights(
            _channel_totals(
                baseline_observations
            ),
            _channel_totals(
                recent_observations
            ),
            settings,
        )
        if settings.include_channel_insights
        else []
    )

    campaign_insights = (
        _build_campaign_insights(
            _campaign_totals(
                baseline_observations
            ),
            _campaign_totals(
                recent_observations
            ),
            settings,
        )
        if settings.include_campaign_insights
        else []
    )

    best_channel = (
        channel_insights[0].channel
        if channel_insights
        else None
    )

    weakest_channel = (
        channel_insights[-1].channel
        if len(channel_insights) > 1
        else None
    )

    best_campaign_key = (
        campaign_insights[0].campaign_key
        if campaign_insights
        else None
    )

    weakest_campaign_key = (
        campaign_insights[-1].campaign_key
        if len(campaign_insights) > 1
        else None
    )

    key_findings: list[str] = [
        (
            "Overall delivery rate is "
            f"{_percentage(summary_rates.delivery_rate)}."
        ),
        (
            "Booking conversion rate is "
            f"{_percentage(summary_rates.booking_conversion_rate)}."
        ),
        (
            "Net attributed marketing revenue is "
            f"{_currency(summary_value.net_attributed_revenue)}."
        ),
    ]

    if best_channel:
        key_findings.append(
            (
                f"{CHANNEL_LABELS.get(best_channel, best_channel)} "
                "is the strongest current marketing channel."
            )
        )

    if campaign_insights:
        key_findings.append(
            (
                f"{campaign_insights[0].campaign_name} "
                "is the highest-scoring campaign."
            )
        )

    recommended_actions: list[str] = []

    if (
        summary_rates.delivery_rate < 0.90
    ):
        recommended_actions.append(
            (
                "Clean invalid contact records and review "
                "provider-level delivery failures."
            )
        )

    if (
        summary_rates.open_rate
        < settings.strong_open_rate
    ):
        recommended_actions.append(
            (
                "Test subject lines, send times and audience segmentation."
            )
        )

    if (
        summary_rates.booking_conversion_rate
        < settings.strong_conversion_rate
    ):
        recommended_actions.append(
            (
                "Use clearer booking calls-to-action and direct booking links."
            )
        )

    if (
        summary_value.marketing_cost > 0
        and summary_value.return_on_marketing_spend < 1.5
    ):
        recommended_actions.append(
            (
                "Reallocate spend away from low-return campaigns."
            )
        )

    if best_channel:
        recommended_actions.append(
            (
                f"Use {CHANNEL_LABELS.get(best_channel, best_channel)} "
                "as the performance benchmark for future tests."
            )
        )

    summary = MarketingInsightsSummary(
        total_audience_size=_quantity(
            max(
                totals[
                    "active_customers"
                ],
                totals[
                    "new_customers"
                ]
                + totals[
                    "returning_customers"
                ],
            )
        ),
        total_messages_sent=_quantity(
            totals[
                "messages_sent"
            ]
        ),
        total_messages_delivered=_quantity(
            totals[
                "messages_delivered"
            ]
        ),
        total_messages_opened=_quantity(
            totals[
                "messages_opened"
            ]
        ),
        total_messages_clicked=_quantity(
            totals[
                "messages_clicked"
            ]
        ),
        total_enquiries=_quantity(
            totals[
                "enquiries"
            ]
        ),
        total_bookings=_quantity(
            totals[
                "bookings"
            ]
        ),
        total_completed_appointments=_quantity(
            totals[
                "completed_appointments"
            ]
        ),
        total_new_customers=_quantity(
            totals[
                "new_customers"
            ]
        ),
        total_returning_customers=_quantity(
            totals[
                "returning_customers"
            ]
        ),
        total_unsubscribes=_quantity(
            totals[
                "unsubscribes"
            ]
        ),
        total_failed_deliveries=_quantity(
            totals[
                "failed_deliveries"
            ]
        ),
        rates=summary_rates,
        value=summary_value,
        engagement_trend=_trend(
            _growth_rate(
                recent_rates.open_rate,
                summary_rates.open_rate,
            )
        ),
        conversion_trend=_trend(
            _growth_rate(
                recent_rates.booking_conversion_rate,
                summary_rates.booking_conversion_rate,
            )
        ),
        revenue_trend=_trend(
            _growth_rate(
                recent_value.revenue_per_message,
                summary_value.revenue_per_message,
            )
        ),
        overall_risk=_overall_risk(
            summary_rates,
            summary_value,
            settings,
        ),
        best_channel=best_channel,
        weakest_channel=weakest_channel,
        best_campaign_key=best_campaign_key,
        weakest_campaign_key=weakest_campaign_key,
        key_findings=key_findings[:20],
        recommended_actions=(
            recommended_actions[:20]
            if settings.include_recommendations
            else []
        ),
        risk_alerts=_risk_alerts(
            summary_rates,
            summary_value,
            settings,
        ),
        data_quality_warnings=_data_quality_warnings(
            payload,
            totals,
            channel_insights,
            campaign_insights,
        ),
    )

    return MarketingInsightsResponse(
        generated_at=(
            datetime.now(
                timezone.utc
            ).isoformat()
        ),
        as_of_date=payload.as_of_date,
        analysis_start=(
            baseline_observations[
                0
            ].business_date
        ),
        analysis_end=(
            baseline_observations[
                -1
            ].business_date
        ),
        summary=summary,
        channel_insights=channel_insights,
        campaign_insights=campaign_insights,
        insights=(
            _marketing_insights(
                summary_rates,
                summary_value,
                channel_insights,
                campaign_insights,
                settings,
            )
            if settings.include_recommendations
            else []
        ),
        metadata=ServiceMetadata(
            model_name=MODEL_NAME,
            provider_mode=provider_mode,
            rules_applied=RULES_APPLIED,
        ),
    )


def build_ai_marketing_insights(
    payload: MarketingInsightsRequest,
    provider_mode: str = "mock",
) -> MarketingInsightsResponse:
    return build_marketing_insights(
        payload,
        provider_mode=provider_mode,
    )


__all__ = [
    "MODEL_NAME",
    "RULES_APPLIED",
    "build_ai_marketing_insights",
    "build_marketing_insights",
]