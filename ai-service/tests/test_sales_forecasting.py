from __future__ import annotations

from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.schemas.sales_forecasting import (
    SalesForecastRequest,
)
from app.services.sales_forecaster import (
    MODEL_NAME,
    build_ai_sales_forecast,
)


def build_observation(
    business_date: date,
    *,
    service_sales: float = 70.0,
    retail_sales: float = 25.0,
    membership_sales: float = 0.0,
    gift_card_sales: float = 0.0,
    other_sales: float = 0.0,
    discounts: float = 5.0,
    refunds: float = 0.0,
    collected_rate: float = 1.0,
    cost_of_goods: float = 12.0,
    transactions: int = 4,
    completed_appointments: int = 3,
    paid_orders: int = 1,
    units_sold: int = 2,
    include_categories: bool = True,
) -> dict:
    net_sales = (
        service_sales
        + retail_sales
        + membership_sales
        + gift_card_sales
        + other_sales
    )

    gross_sales = (
        net_sales
        + discounts
        + refunds
    )

    channels = []

    if service_sales > 0:
        channels.append(
            {
                "channel": "services",
                "gross_sales": service_sales,
                "discounts": 0,
                "refunds": 0,
                "net_sales": service_sales,
                "cost_of_goods": 0,
                "transactions": completed_appointments,
                "units_sold": 0,
            }
        )

    if retail_sales > 0:
        channels.append(
            {
                "channel": "retail",
                "gross_sales": retail_sales,
                "discounts": 0,
                "refunds": 0,
                "net_sales": retail_sales,
                "cost_of_goods": cost_of_goods,
                "transactions": paid_orders,
                "units_sold": units_sold,
            }
        )

    if membership_sales > 0:
        channels.append(
            {
                "channel": "memberships",
                "gross_sales": membership_sales,
                "discounts": 0,
                "refunds": 0,
                "net_sales": membership_sales,
                "cost_of_goods": 0,
                "transactions": 1,
                "units_sold": 1,
            }
        )

    if gift_card_sales > 0:
        channels.append(
            {
                "channel": "gift_cards",
                "gross_sales": gift_card_sales,
                "discounts": 0,
                "refunds": 0,
                "net_sales": gift_card_sales,
                "cost_of_goods": 0,
                "transactions": 1,
                "units_sold": 1,
            }
        )

    if other_sales > 0:
        channels.append(
            {
                "channel": "other",
                "gross_sales": other_sales,
                "discounts": 0,
                "refunds": 0,
                "net_sales": other_sales,
                "cost_of_goods": 0,
                "transactions": 1,
                "units_sold": 1,
            }
        )

    categories = []

    if include_categories:
        if service_sales > 0:
            categories.append(
                {
                    "category_key": "hair-services",
                    "category_name": "Hair services",
                    "channel": "services",
                    "gross_sales": service_sales,
                    "discounts": 0,
                    "refunds": 0,
                    "net_sales": service_sales,
                    "cost_of_goods": 0,
                    "transactions": completed_appointments,
                    "units_sold": 0,
                }
            )

        if retail_sales > 0:
            categories.append(
                {
                    "category_key": "haircare-products",
                    "category_name": "Haircare products",
                    "channel": "retail",
                    "gross_sales": retail_sales,
                    "discounts": 0,
                    "refunds": 0,
                    "net_sales": retail_sales,
                    "cost_of_goods": cost_of_goods,
                    "transactions": paid_orders,
                    "units_sold": units_sold,
                }
            )

    return {
        "business_date": business_date.isoformat(),
        "gross_sales": gross_sales,
        "discounts": discounts,
        "refunds": refunds,
        "net_sales": net_sales,
        "collected_sales": (
            net_sales
            * collected_rate
        ),
        "cost_of_goods": cost_of_goods,
        "transactions": transactions,
        "completed_appointments": completed_appointments,
        "paid_orders": paid_orders,
        "units_sold": units_sold,
        "service_sales": service_sales,
        "retail_sales": retail_sales,
        "membership_sales": membership_sales,
        "gift_card_sales": gift_card_sales,
        "other_sales": other_sales,
        "channels": channels,
        "categories": categories,
    }


def build_observations(
    *,
    as_of_date: date = date(
        2026,
        7,
        28,
    ),
    history_days: int = 84,
    base_service_sales: float = 70.0,
    base_retail_sales: float = 25.0,
    recent_multiplier: float = 1.0,
    recent_days: int = 14,
    discounts: float = 5.0,
    refunds: float = 0.0,
    collected_rate: float = 1.0,
    cost_of_goods: float = 12.0,
    include_categories: bool = True,
) -> list[dict]:
    first_date = (
        as_of_date
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
            + timedelta(days=index)
        )

        is_recent = (
            index
            >= history_days
            - recent_days
        )

        multiplier = (
            recent_multiplier
            if is_recent
            else 1.0
        )

        is_business_day = (
            business_date.weekday()
            in {
                0,
                1,
                2,
                3,
                4,
                5,
            }
        )

        if not is_business_day:
            observations.append(
                build_observation(
                    business_date,
                    service_sales=0,
                    retail_sales=0,
                    discounts=0,
                    refunds=0,
                    collected_rate=0,
                    cost_of_goods=0,
                    transactions=0,
                    completed_appointments=0,
                    paid_orders=0,
                    units_sold=0,
                    include_categories=include_categories,
                )
            )

            continue

        weekday_multiplier = (
            1.20
            if business_date.weekday() == 5
            else 1.0
        )

        observations.append(
            build_observation(
                business_date,
                service_sales=(
                    base_service_sales
                    * multiplier
                    * weekday_multiplier
                ),
                retail_sales=(
                    base_retail_sales
                    * multiplier
                    * weekday_multiplier
                ),
                discounts=(
                    discounts
                    * multiplier
                ),
                refunds=(
                    refunds
                    * multiplier
                ),
                collected_rate=collected_rate,
                cost_of_goods=(
                    cost_of_goods
                    * multiplier
                ),
                transactions=round(
                    4
                    * multiplier
                    * weekday_multiplier
                ),
                completed_appointments=round(
                    3
                    * multiplier
                    * weekday_multiplier
                ),
                paid_orders=max(
                    1,
                    round(
                        multiplier
                        * weekday_multiplier
                    ),
                ),
                units_sold=max(
                    1,
                    round(
                        2
                        * multiplier
                        * weekday_multiplier
                    ),
                ),
                include_categories=include_categories,
            )
        )

    return observations


def build_payload(
    *,
    as_of_date: date = date(
        2026,
        7,
        28,
    ),
    observations: list[dict] | None = None,
    horizon_days: int = 14,
    scenario_adjustment: float = 0.0,
    include_profit_forecast: bool = True,
    include_category_forecast: bool = True,
) -> dict:
    selected_observations = (
        observations
        if observations is not None
        else build_observations(
            as_of_date=as_of_date
        )
    )

    return {
        "as_of_date": as_of_date.isoformat(),
        "observations": selected_observations,
        "settings": {
            "horizon_days": horizon_days,
            "minimum_history_days": 56,
            "recent_window_days": 14,
            "baseline_window_days": 84,
            "confidence_level": 0.90,
            "weekday_seasonality_weight": 0.55,
            "recent_trend_weight": 0.45,
            "scenario_adjustment": scenario_adjustment,
            "business_days": [
                0,
                1,
                2,
                3,
                4,
                5,
            ],
            "include_profit_forecast": include_profit_forecast,
            "include_category_forecast": include_category_forecast,
            "currency": "GBP",
            "timezone": "Europe/London",
        },
    }


def create_forecast(
    **payload_options,
):
    payload = SalesForecastRequest(
        **build_payload(
            **payload_options
        )
    )

    return build_ai_sales_forecast(
        payload,
        provider_mode="mock",
    )


def test_forecast_uses_requested_horizon():
    forecast = create_forecast(
        horizon_days=14
    )

    assert len(
        forecast.forecasts
    ) == 14

    assert (
        forecast.forecast_start
        == date(
            2026,
            7,
            29,
        )
    )

    assert (
        forecast.forecast_end
        == date(
            2026,
            8,
            11,
        )
    )

    assert (
        forecast.as_of_date
        == date(
            2026,
            7,
            28,
        )
    )


def test_closed_business_days_return_zero_sales():
    forecast = create_forecast(
        horizon_days=14
    )

    sundays = [
        item
        for item in forecast.forecasts
        if item.forecast_date.weekday() == 6
    ]

    assert sundays

    for sunday in sundays:
        assert sunday.is_business_day is False
        assert sunday.predicted_net_sales == 0
        assert sunday.predicted_transactions == 0
        assert sunday.sales_risk == "unknown"


def test_recent_sales_growth_increases_forecast():
    flat_forecast = create_forecast(
        observations=build_observations(
            recent_multiplier=1.0
        )
    )

    rising_forecast = create_forecast(
        observations=build_observations(
            recent_multiplier=1.50
        )
    )

    assert (
        rising_forecast
        .summary
        .total_predicted_net_sales
        >
        flat_forecast
        .summary
        .total_predicted_net_sales
    )

    assert (
        rising_forecast
        .summary
        .expected_growth_rate
        >
        flat_forecast
        .summary
        .expected_growth_rate
    )

    assert any(
        item.trend == "rising"
        for item in rising_forecast.forecasts
        if item.is_business_day
    )


def test_channel_sales_are_forecast():
    forecast = create_forecast()

    business_days = [
        item
        for item in forecast.forecasts
        if item.is_business_day
    ]

    assert business_days

    first_day = business_days[0]

    channel_names = {
        item.channel
        for item in first_day.channel_forecasts
    }

    assert "services" in channel_names
    assert "retail" in channel_names

    channel_total = sum(
        item.predicted_net_sales
        for item in first_day.channel_forecasts
    )

    assert channel_total == pytest.approx(
        first_day.predicted_net_sales,
        abs=0.05,
    )

    assert (
        first_day.predicted_service_sales
        >
        first_day.predicted_retail_sales
    )


def test_category_sales_are_forecast():
    forecast = create_forecast()

    business_day = next(
        item
        for item in forecast.forecasts
        if item.is_business_day
    )

    category_keys = {
        item.category_key
        for item in business_day.category_forecasts
    }

    assert "hair-services" in category_keys
    assert "haircare-products" in category_keys
    assert forecast.summary.category_insights


def test_discount_refund_and_profit_metrics():
    observations = build_observations(
        discounts=10.0,
        refunds=4.0,
        cost_of_goods=20.0,
        collected_rate=0.90,
    )

    forecast = create_forecast(
        observations=observations
    )

    summary = forecast.summary

    assert (
        summary.total_predicted_gross_sales
        >
        summary.total_predicted_net_sales
    )

    assert summary.predicted_discount_rate > 0
    assert summary.predicted_refund_rate > 0

    assert (
        summary.total_predicted_gross_profit
        <
        summary.total_predicted_net_sales
    )

    assert (
        0
        < summary.predicted_gross_margin
        < 1
    )

    assert (
        summary.total_predicted_collected_sales
        <
        summary.total_predicted_net_sales
    )


def test_positive_scenario_adjustment_increases_sales():
    baseline = create_forecast(
        scenario_adjustment=0.0
    )

    optimistic = create_forecast(
        scenario_adjustment=0.20
    )

    assert (
        optimistic
        .summary
        .total_predicted_net_sales
        >
        baseline
        .summary
        .total_predicted_net_sales
    )

    ratio = (
        optimistic
        .summary
        .total_predicted_net_sales
        /
        baseline
        .summary
        .total_predicted_net_sales
    )

    assert ratio == pytest.approx(
        1.20,
        rel=0.03,
    )


def test_monthly_forecasts_match_daily_totals():
    forecast = create_forecast(
        horizon_days=45
    )

    monthly_net_sales = sum(
        item.predicted_net_sales
        for item in forecast.monthly_forecasts
    )

    daily_net_sales = sum(
        item.predicted_net_sales
        for item in forecast.forecasts
    )

    assert (
        monthly_net_sales
        == pytest.approx(
            daily_net_sales,
            abs=0.10,
        )
    )

    assert len(
        forecast.monthly_forecasts
    ) >= 2


def test_forecast_metadata_is_explainable():
    forecast = create_forecast()

    assert (
        forecast.metadata.model_name
        == MODEL_NAME
    )

    assert (
        forecast.metadata.provider_mode
        == "mock"
    )

    assert (
        "weekday-seasonality"
        in forecast.metadata.rules_applied
    )

    assert (
        "channel-mix"
        in forecast.metadata.rules_applied
    )

    assert (
        "discount-and-refund-rates"
        in forecast.metadata.rules_applied
    )

    assert forecast.summary.peak_dates
    assert forecast.summary.quiet_dates
    assert forecast.summary.channel_insights


def test_request_rejects_duplicate_observation_dates():
    observations = build_observations()

    observations.append(
        observations[-1].copy()
    )

    with pytest.raises(
        ValidationError
    ) as error:
        SalesForecastRequest(
            **build_payload(
                observations=observations
            )
        )

    assert (
        "Sales observation dates must be unique"
        in str(error.value)
    )


def test_request_rejects_future_observations():
    as_of_date = date(
        2026,
        7,
        28,
    )

    observations = build_observations(
        as_of_date=as_of_date
    )

    observations[-1]["business_date"] = "2026-07-29"

    with pytest.raises(
        ValidationError
    ) as error:
        SalesForecastRequest(
            **build_payload(
                as_of_date=as_of_date,
                observations=observations,
            )
        )

    assert (
        "Sales observations cannot occur after as_of_date"
        in str(error.value)
    )


def test_sales_forecasting_endpoint_requires_service_key(
    client,
):
    response = client.post(
        "/api/v1/sales-forecasting/forecast",
        json=build_payload(),
    )

    assert response.status_code == 401

    data = response.json()

    assert (
        data["detail"]["code"]
        == "INVALID_SERVICE_KEY"
    )


def test_sales_forecasting_endpoint_returns_forecast(
    client,
    auth_headers,
):
    response = client.post(
        "/api/v1/sales-forecasting/forecast",
        headers=auth_headers,
        json=build_payload(
            horizon_days=14
        ),
    )

    assert response.status_code == 200

    data = response.json()

    assert (
        data["metadata"]["model_name"]
        == MODEL_NAME
    )

    assert (
        data["metadata"]["provider_mode"]
        == "mock"
    )

    assert len(
        data["forecasts"]
    ) == 14

    assert (
        data["summary"][
            "total_predicted_net_sales"
        ]
        > 0
    )

    assert (
        data["summary"][
            "total_predicted_service_sales"
        ]
        > 0
    )

    assert (
        data["summary"][
            "total_predicted_retail_sales"
        ]
        > 0
    )

    assert data["monthly_forecasts"]


def test_invalid_financial_totals_return_validation_error(
    client,
    auth_headers,
):
    payload = build_payload()

    payload["observations"][0]["net_sales"] = 9999

    response = client.post(
        "/api/v1/sales-forecasting/forecast",
        headers=auth_headers,
        json=payload,
    )

    assert response.status_code == 422

    data = response.json()

    assert data["code"] == "VALIDATION_ERROR"