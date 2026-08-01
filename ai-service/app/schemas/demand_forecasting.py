from datetime import date, datetime
from typing import Literal

from pydantic import (
    BaseModel,
    Field,
    field_validator,
    model_validator,
)

from app.schemas.common import ServiceMetadata


DemandTrend = Literal[
    "rising",
    "stable",
    "falling",
]

TimeBucket = Literal[
    "morning",
    "afternoon",
    "evening",
]

UtilisationRisk = Literal[
    "low",
    "balanced",
    "high",
    "unknown",
]


class ServiceDemandObservation(BaseModel):
    service_key: str = Field(
        min_length=1,
        max_length=100,
    )

    service_name: str = Field(
        min_length=1,
        max_length=200,
    )

    booked_appointments: int = Field(
        default=0,
        ge=0,
    )

    completed_appointments: int = Field(
        default=0,
        ge=0,
    )

    cancelled_appointments: int = Field(
        default=0,
        ge=0,
    )

    no_show_appointments: int = Field(
        default=0,
        ge=0,
    )

    revenue: float = Field(
        default=0,
        ge=0,
    )

    @field_validator(
        "service_key",
        "service_name",
    )
    @classmethod
    def clean_text(
        cls,
        value: str,
    ) -> str:
        return value.strip()

    @model_validator(mode="after")
    def validate_status_totals(
        self,
    ) -> "ServiceDemandObservation":
        resolved_appointments = (
            self.completed_appointments
            + self.cancelled_appointments
            + self.no_show_appointments
        )

        if (
            resolved_appointments
            > self.booked_appointments
        ):
            raise ValueError(
                "Service status totals cannot exceed "
                "booked_appointments."
            )

        return self


class TimeBucketDemandObservation(BaseModel):
    bucket: TimeBucket

    booked_appointments: int = Field(
        default=0,
        ge=0,
    )

    completed_appointments: int = Field(
        default=0,
        ge=0,
    )

    cancelled_appointments: int = Field(
        default=0,
        ge=0,
    )

    no_show_appointments: int = Field(
        default=0,
        ge=0,
    )

    @model_validator(mode="after")
    def validate_status_totals(
        self,
    ) -> "TimeBucketDemandObservation":
        resolved_appointments = (
            self.completed_appointments
            + self.cancelled_appointments
            + self.no_show_appointments
        )

        if (
            resolved_appointments
            > self.booked_appointments
        ):
            raise ValueError(
                "Time-bucket status totals cannot exceed "
                "booked_appointments."
            )

        return self


class DailyDemandObservation(BaseModel):
    business_date: date

    booked_appointments: int = Field(
        default=0,
        ge=0,
    )

    completed_appointments: int = Field(
        default=0,
        ge=0,
    )

    cancelled_appointments: int = Field(
        default=0,
        ge=0,
    )

    no_show_appointments: int = Field(
        default=0,
        ge=0,
    )

    pending_appointments: int = Field(
        default=0,
        ge=0,
    )

    total_revenue: float = Field(
        default=0,
        ge=0,
    )

    available_staff_hours: float = Field(
        default=0,
        ge=0,
    )

    appointment_capacity: int = Field(
        default=0,
        ge=0,
    )

    services: list[
        ServiceDemandObservation
    ] = Field(
        default_factory=list,
        max_length=100,
    )

    time_buckets: list[
        TimeBucketDemandObservation
    ] = Field(
        default_factory=list,
        max_length=3,
    )

    @model_validator(mode="after")
    def validate_observation(
        self,
    ) -> "DailyDemandObservation":
        resolved_appointments = (
            self.completed_appointments
            + self.cancelled_appointments
            + self.no_show_appointments
            + self.pending_appointments
        )

        if (
            resolved_appointments
            > self.booked_appointments
        ):
            raise ValueError(
                "Daily appointment status totals cannot "
                "exceed booked_appointments."
            )

        service_keys = [
            service.service_key
            for service in self.services
        ]

        if (
            len(service_keys)
            != len(set(service_keys))
        ):
            raise ValueError(
                "Each service_key must be unique "
                "within a daily observation."
            )

        time_bucket_keys = [
            item.bucket
            for item in self.time_buckets
        ]

        if (
            len(time_bucket_keys)
            != len(set(time_bucket_keys))
        ):
            raise ValueError(
                "Each time bucket must be unique "
                "within a daily observation."
            )

        return self


class DemandForecastSettings(BaseModel):
    horizon_days: int = Field(
        default=28,
        ge=7,
        le=90,
    )

    minimum_history_days: int = Field(
        default=28,
        ge=14,
        le=365,
    )

    recent_window_days: int = Field(
        default=28,
        ge=7,
        le=120,
    )

    baseline_window_days: int = Field(
        default=84,
        ge=28,
        le=365,
    )

    confidence_level: float = Field(
        default=0.90,
        ge=0.50,
        le=0.99,
    )

    target_utilisation: float = Field(
        default=0.80,
        ge=0.50,
        le=0.98,
    )

    appointments_per_staff_hour: float = Field(
        default=0.75,
        gt=0,
        le=10,
    )

    staff_shift_hours: float = Field(
        default=8,
        gt=0,
        le=24,
    )

    business_days: list[int] = Field(
        default_factory=lambda: [
            0,
            1,
            2,
            3,
            4,
            5,
        ],
        min_length=1,
        max_length=7,
    )

    include_revenue_forecast: bool = True

    currency: str = Field(
        default="GBP",
        min_length=3,
        max_length=3,
    )

    timezone: str = Field(
        default="Europe/London",
        min_length=1,
        max_length=100,
    )

    @field_validator("business_days")
    @classmethod
    def validate_business_days(
        cls,
        values: list[int],
    ) -> list[int]:
        unique_values = sorted(set(values))

        if any(
            value < 0 or value > 6
            for value in unique_values
        ):
            raise ValueError(
                "business_days values must use Python "
                "weekday numbers from 0 to 6."
            )

        return unique_values

    @field_validator("currency")
    @classmethod
    def normalise_currency(
        cls,
        value: str,
    ) -> str:
        normalised = value.strip().upper()

        if not normalised.isalpha():
            raise ValueError(
                "currency must be a three-letter code."
            )

        return normalised

    @field_validator("timezone")
    @classmethod
    def clean_timezone(
        cls,
        value: str,
    ) -> str:
        return value.strip()

    @model_validator(mode="after")
    def validate_windows(
        self,
    ) -> "DemandForecastSettings":
        if (
            self.recent_window_days
            > self.baseline_window_days
        ):
            raise ValueError(
                "recent_window_days cannot exceed "
                "baseline_window_days."
            )

        return self


class AppointmentDemandForecastRequest(
    BaseModel
):
    as_of_date: date

    observations: list[
        DailyDemandObservation
    ] = Field(
        min_length=14,
        max_length=730,
    )

    settings: DemandForecastSettings = Field(
        default_factory=DemandForecastSettings
    )

    @field_validator("observations")
    @classmethod
    def validate_observations(
        cls,
        values: list[
            DailyDemandObservation
        ],
    ) -> list[DailyDemandObservation]:
        dates = [
            observation.business_date
            for observation in values
        ]

        if len(dates) != len(set(dates)):
            raise ValueError(
                "Each business_date must be unique."
            )

        return sorted(
            values,
            key=lambda observation:
                observation.business_date,
        )

    @model_validator(mode="after")
    def validate_history_dates(
        self,
    ) -> "AppointmentDemandForecastRequest":
        future_observations = [
            observation.business_date
            for observation
            in self.observations
            if (
                observation.business_date
                > self.as_of_date
            )
        ]

        if future_observations:
            raise ValueError(
                "Historical observations cannot be "
                "later than as_of_date."
            )

        return self


class ServiceDemandForecast(BaseModel):
    service_key: str

    service_name: str

    predicted_appointments: float = Field(
        ge=0,
    )

    demand_share: float = Field(
        ge=0,
        le=1,
    )

    trend: DemandTrend

    confidence: float = Field(
        ge=0,
        le=1,
    )

    explanation: str


class TimeBucketDemandForecast(BaseModel):
    bucket: TimeBucket

    predicted_appointments: float = Field(
        ge=0,
    )

    demand_share: float = Field(
        ge=0,
        le=1,
    )

    staffing_signal: str


class DailyDemandForecast(BaseModel):
    forecast_date: date

    day_name: str

    predicted_bookings: float = Field(
        ge=0,
    )

    lower_bound: float = Field(
        ge=0,
    )

    upper_bound: float = Field(
        ge=0,
    )

    predicted_completed: float = Field(
        ge=0,
    )

    predicted_cancellations: float = Field(
        ge=0,
    )

    predicted_no_shows: float = Field(
        ge=0,
    )

    predicted_revenue: float = Field(
        ge=0,
    )

    required_staff_hours: float = Field(
        ge=0,
    )

    recommended_staff_count: int = Field(
        ge=0,
    )

    historical_capacity: float = Field(
        ge=0,
    )

    expected_utilisation: float = Field(
        ge=0,
    )

    utilisation_risk: UtilisationRisk

    demand_index: float = Field(
        ge=0,
    )

    is_peak_day: bool = False

    service_forecasts: list[
        ServiceDemandForecast
    ] = Field(
        default_factory=list,
    )

    time_bucket_forecasts: list[
        TimeBucketDemandForecast
    ] = Field(
        default_factory=list,
    )

    explanation: str


class DemandForecastSummary(BaseModel):
    total_predicted_bookings: float = Field(
        ge=0,
    )

    average_daily_bookings: float = Field(
        ge=0,
    )

    total_predicted_revenue: float = Field(
        ge=0,
    )

    average_daily_revenue: float = Field(
        ge=0,
    )

    predicted_cancellation_rate: float = Field(
        ge=0,
        le=1,
    )

    predicted_no_show_rate: float = Field(
        ge=0,
        le=1,
    )

    peak_dates: list[date] = Field(
        default_factory=list,
    )

    quiet_dates: list[date] = Field(
        default_factory=list,
    )

    staffing_alerts: list[str] = Field(
        default_factory=list,
    )

    service_insights: list[str] = Field(
        default_factory=list,
    )

    data_quality_warnings: list[str] = Field(
        default_factory=list,
    )


class AppointmentDemandForecastResponse(
    BaseModel
):
    generated_at: datetime

    as_of_date: date

    forecast_start: date

    forecast_end: date

    history_start: date

    history_end: date

    forecasts: list[
        DailyDemandForecast
    ]

    summary: DemandForecastSummary

    settings: DemandForecastSettings

    metadata: ServiceMetadata