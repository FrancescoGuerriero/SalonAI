from datetime import date, timedelta

from app.schemas.demand_forecasting import (
    AppointmentDemandForecastRequest,
    DailyDemandObservation,
    DemandForecastSettings,
    ServiceDemandObservation,
    TimeBucketDemandObservation,
)
from app.services.demand_forecaster import (
    build_appointment_demand_forecast,
)


AS_OF_DATE = date(
    2026,
    7,
    28,
)


def build_observations(
    *,
    days: int = 84,
    rising_recent_demand: bool = False,
) -> list[DailyDemandObservation]:
    observations: list[
        DailyDemandObservation
    ] = []

    start_date = (
        AS_OF_DATE
        - timedelta(
            days=days - 1,
        )
    )

    weekday_bookings = {
        0: 8,
        1: 9,
        2: 10,
        3: 11,
        4: 13,
        5: 16,
        6: 0,
    }

    for index in range(days):
        business_date = (
            start_date
            + timedelta(days=index)
        )

        weekday = (
            business_date.weekday()
        )

        booked = (
            weekday_bookings[
                weekday
            ]
        )

        is_recent = (
            business_date
            >= AS_OF_DATE
            - timedelta(days=27)
        )

        if (
            rising_recent_demand
            and is_recent
            and booked > 0
        ):
            booked += 4

        if booked <= 0:
            observations.append(
                DailyDemandObservation(
                    business_date=
                        business_date,

                    booked_appointments=0,

                    completed_appointments=0,

                    cancelled_appointments=0,

                    no_show_appointments=0,

                    pending_appointments=0,

                    total_revenue=0,

                    available_staff_hours=0,

                    appointment_capacity=0,

                    services=[],

                    time_buckets=[],
                )
            )

            continue

        cancelled = 1
        no_show = 1

        completed = max(
            0,
            booked
            - cancelled
            - no_show,
        )

        cut_bookings = round(
            booked * 0.60
        )

        colour_bookings = (
            booked
            - cut_bookings
        )

        morning_bookings = round(
            booked * 0.35
        )

        afternoon_bookings = round(
            booked * 0.50
        )

        evening_bookings = max(
            0,
            booked
            - morning_bookings
            - afternoon_bookings,
        )

        staff_hours = (
            16
            if weekday == 5
            else 12
        )

        observations.append(
            DailyDemandObservation(
                business_date=
                    business_date,

                booked_appointments=
                    booked,

                completed_appointments=
                    completed,

                cancelled_appointments=
                    cancelled,

                no_show_appointments=
                    no_show,

                pending_appointments=0,

                total_revenue=
                    completed * 55,

                available_staff_hours=
                    staff_hours,

                appointment_capacity=
                    round(
                        staff_hours
                        * 0.75
                    ),

                services=[
                    ServiceDemandObservation(
                        service_key=
                            "cut-finish",

                        service_name=
                            "Cut and finish",

                        booked_appointments=
                            cut_bookings,

                        completed_appointments=
                            max(
                                0,
                                cut_bookings
                                - 1,
                            ),

                        cancelled_appointments=
                            (
                                1
                                if cut_bookings
                                > 1
                                else 0
                            ),

                        no_show_appointments=0,

                        revenue=
                            max(
                                0,
                                cut_bookings
                                - 1,
                            )
                            * 45,
                    ),

                    ServiceDemandObservation(
                        service_key=
                            "colour-service",

                        service_name=
                            "Colour service",

                        booked_appointments=
                            colour_bookings,

                        completed_appointments=
                            max(
                                0,
                                colour_bookings
                                - 1,
                            ),

                        cancelled_appointments=0,

                        no_show_appointments=
                            (
                                1
                                if colour_bookings
                                > 1
                                else 0
                            ),

                        revenue=
                            max(
                                0,
                                colour_bookings
                                - 1,
                            )
                            * 75,
                    ),
                ],

                time_buckets=[
                    TimeBucketDemandObservation(
                        bucket="morning",

                        booked_appointments=
                            morning_bookings,

                        completed_appointments=
                            morning_bookings,

                        cancelled_appointments=0,

                        no_show_appointments=0,
                    ),

                    TimeBucketDemandObservation(
                        bucket="afternoon",

                        booked_appointments=
                            afternoon_bookings,

                        completed_appointments=
                            afternoon_bookings,

                        cancelled_appointments=0,

                        no_show_appointments=0,
                    ),

                    TimeBucketDemandObservation(
                        bucket="evening",

                        booked_appointments=
                            evening_bookings,

                        completed_appointments=
                            evening_bookings,

                        cancelled_appointments=0,

                        no_show_appointments=0,
                    ),
                ],
            )
        )

    return observations


def build_request(
    *,
    horizon_days: int = 14,
    rising_recent_demand: bool = False,
) -> AppointmentDemandForecastRequest:
    return (
        AppointmentDemandForecastRequest(
            as_of_date=
                AS_OF_DATE,

            observations=
                build_observations(
                    rising_recent_demand=
                        rising_recent_demand,
                ),

            settings=
                DemandForecastSettings(
                    horizon_days=
                        horizon_days,

                    minimum_history_days=28,

                    recent_window_days=28,

                    baseline_window_days=84,

                    confidence_level=0.90,

                    target_utilisation=0.80,

                    appointments_per_staff_hour=
                        0.75,

                    staff_shift_hours=8,

                    business_days=[
                        0,
                        1,
                        2,
                        3,
                        4,
                        5,
                    ],

                    include_revenue_forecast=
                        True,

                    currency="GBP",

                    timezone=
                        "Europe/London",
                ),
        )
    )


def test_forecast_returns_requested_horizon():
    result = (
        build_appointment_demand_forecast(
            build_request(
                horizon_days=14
            ),
            provider_mode="mock",
        )
    )

    assert len(
        result.forecasts
    ) == 14

    assert result.forecast_start == (
        AS_OF_DATE
        + timedelta(days=1)
    )

    assert result.forecast_end == (
        AS_OF_DATE
        + timedelta(days=14)
    )

    assert (
        result.metadata.provider_mode
        == "mock"
    )

    assert (
        result.metadata.model_name
        == (
            "salonai-demand-"
            "forecast-rules-v1"
        )
    )

    assert (
        "weekday-seasonality"
        in result.metadata.rules_applied
    )

    assert (
        "capacity-utilisation"
        in result.metadata.rules_applied
    )


def test_forecast_contains_staffing_and_revenue():
    result = (
        build_appointment_demand_forecast(
            build_request(),
            provider_mode="mock",
        )
    )

    business_days = [
        forecast
        for forecast
        in result.forecasts
        if (
            forecast
            .predicted_bookings
            > 0
        )
    ]

    assert business_days

    for forecast in business_days:
        assert (
            forecast
            .predicted_bookings
            > 0
        )

        assert (
            forecast
            .upper_bound
            >= forecast
            .predicted_bookings
        )

        assert (
            forecast
            .lower_bound
            <= forecast
            .predicted_bookings
        )

        assert (
            forecast
            .required_staff_hours
            > 0
        )

        assert (
            forecast
            .recommended_staff_count
            >= 1
        )

        assert (
            forecast
            .predicted_revenue
            > 0
        )


def test_closed_weekdays_return_zero_demand():
    result = (
        build_appointment_demand_forecast(
            build_request(
                horizon_days=14
            ),
            provider_mode="mock",
        )
    )

    sunday_forecasts = [
        forecast
        for forecast
        in result.forecasts
        if (
            forecast
            .forecast_date
            .weekday()
            == 6
        )
    ]

    assert sunday_forecasts

    for forecast in sunday_forecasts:
        assert (
            forecast
            .predicted_bookings
            == 0
        )

        assert (
            forecast
            .recommended_staff_count
            == 0
        )

        assert (
            forecast
            .predicted_revenue
            == 0
        )

        assert (
            "closed"
            in forecast
            .explanation
            .lower()
        )


def test_service_and_time_bucket_forecasts_are_returned():
    result = (
        build_appointment_demand_forecast(
            build_request(),
            provider_mode="mock",
        )
    )

    forecast = next(
        item
        for item
        in result.forecasts
        if (
            item
            .predicted_bookings
            > 0
        )
    )

    service_keys = {
        item.service_key
        for item
        in forecast
        .service_forecasts
    }

    assert (
        "cut-finish"
        in service_keys
    )

    assert (
        "colour-service"
        in service_keys
    )

    bucket_names = {
        item.bucket
        for item
        in forecast
        .time_bucket_forecasts
    }

    assert bucket_names == {
        "morning",
        "afternoon",
        "evening",
    }

    service_share_total = sum(
        item.demand_share
        for item
        in forecast
        .service_forecasts
    )

    assert (
        0.95
        <= service_share_total
        <= 1.05
    )


def test_recent_growth_increases_forecast():
    stable_result = (
        build_appointment_demand_forecast(
            build_request(
                rising_recent_demand=False
            ),
            provider_mode="mock",
        )
    )

    rising_result = (
        build_appointment_demand_forecast(
            build_request(
                rising_recent_demand=True
            ),
            provider_mode="mock",
        )
    )

    assert (
        rising_result
        .summary
        .total_predicted_bookings
        >
        stable_result
        .summary
        .total_predicted_bookings
    )


def test_summary_contains_operational_insights():
    result = (
        build_appointment_demand_forecast(
            build_request(),
            provider_mode="mock",
        )
    )

    assert (
        result.summary
        .total_predicted_bookings
        > 0
    )

    assert (
        result.summary
        .average_daily_bookings
        > 0
    )

    assert (
        result.summary
        .total_predicted_revenue
        > 0
    )

    assert (
        0
        <= result.summary
        .predicted_cancellation_rate
        <= 1
    )

    assert (
        0
        <= result.summary
        .predicted_no_show_rate
        <= 1
    )

    assert (
        result.summary
        .service_insights
    )


def test_endpoint_requires_service_key(
    client,
):
    request = build_request()

    response = client.post(
        (
            "/api/v1/"
            "demand-forecasting/"
            "forecast"
        ),
        json=request.model_dump(
            mode="json"
        ),
    )

    assert response.status_code == 401

    payload = response.json()

    assert (
        payload["code"]
        == "INVALID_SERVICE_KEY"
    )


def test_endpoint_returns_forecast(
    client,
    auth_headers,
):
    request = build_request(
        horizon_days=7
    )

    response = client.post(
        (
            "/api/v1/"
            "demand-forecasting/"
            "forecast"
        ),
        headers=auth_headers,
        json=request.model_dump(
            mode="json"
        ),
    )

    assert response.status_code == 200

    payload = response.json()

    assert len(
        payload["forecasts"]
    ) == 7

    assert (
        payload["metadata"]
        ["provider_mode"]
        == "mock"
    )

    assert (
        payload["summary"]
        ["total_predicted_bookings"]
        > 0
    )


def test_duplicate_observation_dates_are_rejected(
    client,
    auth_headers,
):
    request = build_request()

    payload = request.model_dump(
        mode="json"
    )

    payload[
        "observations"
    ][1]["business_date"] = (
        payload[
            "observations"
        ][0]["business_date"]
    )

    response = client.post(
        (
            "/api/v1/"
            "demand-forecasting/"
            "forecast"
        ),
        headers=auth_headers,
        json=payload,
    )

    assert response.status_code == 422

    error_payload = response.json()

    assert (
        error_payload["code"]
        == "VALIDATION_ERROR"
    )
    