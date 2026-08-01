from __future__ import annotations

from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.schemas.marketing_insights import (
    MarketingInsightsRequest,
)
from app.services.marketing_insights_analyser import (
    MODEL_NAME,
    build_ai_marketing_insights,
)


AS_OF_DATE = date(
    2026,
    7,
    28,
)


def build_channel(
    *,
    channel: str = "email",
    audience_size: int = 100,
    messages_sent: int = 100,
    messages_delivered: int = 95,
    messages_opened: int = 45,
    messages_clicked: int = 12,
    enquiries: int = 8,
    bookings: int = 6,
    completed_appointments: int = 5,
    new_customers: int = 2,
    returning_customers: int = 3,
    unsubscribes: int = 1,
    failed_deliveries: int = 5,
    marketing_cost: float = 20.0,
    attributed_revenue: float = 300.0,
    discounts_redeemed: float = 10.0,
    refunds: float = 0.0,
) -> dict:
    return {
        "channel": channel,
        "audience_size": audience_size,
        "messages_sent": messages_sent,
        "messages_delivered": messages_delivered,
        "messages_opened": messages_opened,
        "messages_clicked": messages_clicked,
        "enquiries": enquiries,
        "bookings": bookings,
        "completed_appointments": completed_appointments,
        "new_customers": new_customers,
        "returning_customers": returning_customers,
        "unsubscribes": unsubscribes,
        "failed_deliveries": failed_deliveries,
        "marketing_cost": marketing_cost,
        "attributed_revenue": attributed_revenue,
        "discounts_redeemed": discounts_redeemed,
        "refunds": refunds,
    }


def build_campaign(
    *,
    campaign_key: str = "summer-email",
    campaign_name: str = "Summer Haircare",
    channel: str = "email",
    status: str = "completed",
    audience_segment: str = "Active customers",
    started_on: str = "2026-06-01",
    ended_on: str = "2026-06-30",
    audience_size: int = 100,
    messages_sent: int = 100,
    messages_delivered: int = 95,
    messages_opened: int = 45,
    messages_clicked: int = 12,
    bookings: int = 6,
    completed_appointments: int = 5,
    new_customers: int = 2,
    returning_customers: int = 3,
    unsubscribes: int = 1,
    failed_deliveries: int = 5,
    marketing_cost: float = 20.0,
    attributed_revenue: float = 300.0,
    discounts_redeemed: float = 10.0,
    refunds: float = 0.0,
) -> dict:
    return {
        "campaign_key": campaign_key,
        "campaign_name": campaign_name,
        "channel": channel,
        "status": status,
        "audience_segment": audience_segment,
        "started_on": started_on,
        "ended_on": ended_on,
        "audience_size": audience_size,
        "messages_sent": messages_sent,
        "messages_delivered": messages_delivered,
        "messages_opened": messages_opened,
        "messages_clicked": messages_clicked,
        "bookings": bookings,
        "completed_appointments": completed_appointments,
        "new_customers": new_customers,
        "returning_customers": returning_customers,
        "unsubscribes": unsubscribes,
        "failed_deliveries": failed_deliveries,
        "marketing_cost": marketing_cost,
        "attributed_revenue": attributed_revenue,
        "discounts_redeemed": discounts_redeemed,
        "refunds": refunds,
    }


def build_observation(
    business_date: date,
    *,
    channel_multiplier: float = 1.0,
    include_campaign: bool = True,
    failed_deliveries: int = 5,
    unsubscribes: int = 1,
) -> dict:
    messages_sent = round(
        100 * channel_multiplier
    )

    messages_delivered = max(
        0,
        messages_sent
        - failed_deliveries,
    )

    messages_opened = min(
        messages_delivered,
        round(
            45 * channel_multiplier
        ),
    )

    messages_clicked = min(
        messages_opened,
        round(
            12 * channel_multiplier
        ),
    )

    bookings = round(
        6 * channel_multiplier
    )

    completed = round(
        5 * channel_multiplier
    )

    attributed_revenue = (
        300.0
        * channel_multiplier
    )

    channel = build_channel(
        messages_sent=messages_sent,
        messages_delivered=messages_delivered,
        messages_opened=messages_opened,
        messages_clicked=messages_clicked,
        bookings=bookings,
        completed_appointments=completed,
        failed_deliveries=failed_deliveries,
        unsubscribes=min(
            unsubscribes,
            messages_delivered,
        ),
        marketing_cost=(
            20.0
            * channel_multiplier
        ),
        attributed_revenue=attributed_revenue,
    )

    campaigns = []

    if include_campaign:
        campaigns.append(
            build_campaign(
                messages_sent=messages_sent,
                messages_delivered=messages_delivered,
                messages_opened=messages_opened,
                messages_clicked=messages_clicked,
                bookings=bookings,
                completed_appointments=completed,
                failed_deliveries=failed_deliveries,
                unsubscribes=min(
                    unsubscribes,
                    messages_delivered,
                ),
                marketing_cost=(
                    20.0
                    * channel_multiplier
                ),
                attributed_revenue=attributed_revenue,
            )
        )

    return {
        "business_date": (
            business_date.isoformat()
        ),
        "active_customers": 120,
        "new_customers": 2,
        "returning_customers": 5,
        "enquiries": 8,
        "bookings": bookings,
        "completed_appointments": completed,
        "cancelled_appointments": 1,
        "no_show_appointments": 0,
        "messages_sent": messages_sent,
        "messages_delivered": messages_delivered,
        "messages_opened": messages_opened,
        "messages_clicked": messages_clicked,
        "unsubscribes": min(
            unsubscribes,
            messages_delivered,
        ),
        "failed_deliveries": failed_deliveries,
        "marketing_cost": (
            20.0
            * channel_multiplier
        ),
        "attributed_revenue": attributed_revenue,
        "total_revenue": (
            500.0
            * channel_multiplier
        ),
        "discounts_redeemed": (
            10.0
            * channel_multiplier
        ),
        "refunds": 0,
        "channels": [
            channel,
        ],
        "campaigns": campaigns,
    }


def build_observations(
    *,
    history_days: int = 180,
    recent_multiplier: float = 1.0,
    recent_days: int = 30,
    include_campaign: bool = True,
    failed_deliveries: int = 5,
    unsubscribes: int = 1,
) -> list[dict]:
    first_date = (
        AS_OF_DATE
        - timedelta(
            days=history_days - 1
        )
    )

    observations = []

    for index in range(
        history_days
    ):
        business_date = (
            first_date
            + timedelta(
                days=index
            )
        )

        multiplier = (
            recent_multiplier
            if index
            >= history_days
            - recent_days
            else 1.0
        )

        observations.append(
            build_observation(
                business_date,
                channel_multiplier=multiplier,
                include_campaign=include_campaign,
                failed_deliveries=failed_deliveries,
                unsubscribes=unsubscribes,
            )
        )

    return observations


def build_payload(
    *,
    observations: list[dict] | None = None,
    include_campaign_insights: bool = True,
    include_channel_insights: bool = True,
    include_recommendations: bool = True,
) -> dict:
    return {
        "as_of_date": (
            AS_OF_DATE.isoformat()
        ),
        "observations": (
            observations
            if observations is not None
            else build_observations()
        ),
        "settings": {
            "recent_window_days": 30,
            "baseline_window_days": 180,
            "minimum_history_days": 90,
            "minimum_campaign_messages": 20,
            "minimum_channel_messages": 30,
            "strong_open_rate": 0.35,
            "strong_click_rate": 0.08,
            "strong_conversion_rate": 0.05,
            "high_unsubscribe_rate": 0.02,
            "high_failure_rate": 0.08,
            "include_campaign_insights": (
                include_campaign_insights
            ),
            "include_channel_insights": (
                include_channel_insights
            ),
            "include_recommendations": (
                include_recommendations
            ),
            "currency": "GBP",
            "timezone": "Europe/London",
        },
    }


def create_insights(
    **payload_options,
):
    payload = MarketingInsightsRequest(
        **build_payload(
            **payload_options
        )
    )

    return build_ai_marketing_insights(
        payload,
        provider_mode="mock",
    )


def test_marketing_insights_returns_summary():
    result = create_insights()

    assert (
        result.metadata.model_name
        == MODEL_NAME
    )

    assert (
        result.metadata.provider_mode
        == "mock"
    )

    assert (
        result.summary.total_messages_sent
        > 0
    )

    assert (
        result.summary.total_bookings
        > 0
    )

    assert (
        result.summary.value.net_attributed_revenue
        > 0
    )


def test_channel_insights_are_generated():
    result = create_insights()

    assert result.channel_insights

    channel = (
        result.channel_insights[0]
    )

    assert channel.channel == "email"

    assert (
        channel.rates.delivery_rate
        > 0
    )

    assert (
        channel.rates.booking_conversion_rate
        > 0
    )

    assert (
        channel.value.return_on_marketing_spend
        > 0
    )


def test_campaign_insights_are_generated():
    result = create_insights()

    assert result.campaign_insights

    campaign = (
        result.campaign_insights[0]
    )

    assert (
        campaign.campaign_key
        == "summer-email"
    )

    assert (
        campaign.performance_score
        > 0
    )

    assert campaign.strengths


def test_recent_growth_changes_trends():
    result = create_insights(
        observations=build_observations(
            recent_multiplier=1.5
        )
    )

    assert (
        result.summary.engagement_trend
        in {
            "stable",
            "rising",
        }
    )

    assert (
        result.summary.conversion_trend
        in {
            "stable",
            "rising",
        }
    )

    assert (
        result.summary.revenue_trend
        in {
            "stable",
            "rising",
        }
    )


def test_high_delivery_failures_create_risk():
    observations = (
        build_observations(
            failed_deliveries=20
        )
    )

    result = create_insights(
        observations=observations
    )

    assert (
        result.summary.overall_risk
        == "high"
    )

    assert (
        result.summary.risk_alerts
    )


def test_recommendations_can_be_disabled():
    result = create_insights(
        include_recommendations=False
    )

    assert (
        result.summary.recommended_actions
        == []
    )

    assert result.insights == []


def test_channel_insights_can_be_disabled():
    result = create_insights(
        include_channel_insights=False
    )

    assert (
        result.channel_insights
        == []
    )


def test_campaign_insights_can_be_disabled():
    result = create_insights(
        include_campaign_insights=False
    )

    assert (
        result.campaign_insights
        == []
    )


def test_duplicate_dates_are_rejected():
    observations = (
        build_observations()
    )

    observations.append(
        observations[-1].copy()
    )

    with pytest.raises(
        ValidationError
    ) as error:
        MarketingInsightsRequest(
            **build_payload(
                observations=observations
            )
        )

    assert (
        "Marketing observation dates must be unique"
        in str(error.value)
    )


def test_future_observation_is_rejected():
    observations = (
        build_observations()
    )

    observations[-1][
        "business_date"
    ] = "2026-07-29"

    with pytest.raises(
        ValidationError
    ) as error:
        MarketingInsightsRequest(
            **build_payload(
                observations=observations
            )
        )

    assert (
        "Marketing observations cannot occur after as_of_date"
        in str(error.value)
    )


def test_invalid_delivery_totals_are_rejected():
    observations = (
        build_observations()
    )

    observations[0][
        "messages_delivered"
    ] = (
        observations[0][
            "messages_sent"
        ]
        + 1
    )

    with pytest.raises(
        ValidationError
    ) as error:
        MarketingInsightsRequest(
            **build_payload(
                observations=observations
            )
        )

    assert (
        "messages_delivered cannot exceed messages_sent"
        in str(error.value)
    )


def test_endpoint_requires_service_key(
    client,
):
    response = client.post(
        "/api/v1/marketing-insights/analyse",
        json=build_payload(),
    )

    assert (
        response.status_code
        == 401
    )

    data = response.json()

    assert (
        data["detail"]["code"]
        == "INVALID_SERVICE_KEY"
    )


def test_endpoint_returns_marketing_insights(
    client,
    auth_headers,
):
    response = client.post(
        "/api/v1/marketing-insights/analyse",
        headers=auth_headers,
        json=build_payload(),
    )

    assert (
        response.status_code
        == 200
    )

    data = response.json()

    assert (
        data["metadata"]["model_name"]
        == MODEL_NAME
    )

    assert (
        data["summary"]["total_messages_sent"]
        > 0
    )

    assert data["channel_insights"]
    assert data["campaign_insights"]
    assert data["insights"]


def test_endpoint_returns_structured_validation_error(
    client,
    auth_headers,
):
    payload = build_payload()

    payload["observations"][0][
        "messages_opened"
    ] = 9999

    response = client.post(
        "/api/v1/marketing-insights/analyse",
        headers=auth_headers,
        json=payload,
    )

    assert (
        response.status_code
        == 422
    )

    data = response.json()

    assert (
        data["code"]
        == "VALIDATION_ERROR"
    )