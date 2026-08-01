from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.schemas.common import ServiceMetadata


SalesChannel = Literal[
    "services",
    "retail",
    "memberships",
    "gift_cards",
    "other",
]

SalesTrend = Literal[
    "rising",
    "stable",
    "falling",
]

SalesRisk = Literal[
    "high",
    "medium",
    "low",
    "balanced",
    "unknown",
]


class SalesForecastModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class ChannelSalesObservation(
    SalesForecastModel
):
    channel: SalesChannel

    gross_sales: float = Field(
        default=0,
        ge=0,
    )

    discounts: float = Field(
        default=0,
        ge=0,
    )

    refunds: float = Field(
        default=0,
        ge=0,
    )

    net_sales: float = 0

    cost_of_goods: float = Field(
        default=0,
        ge=0,
    )

    transactions: int = Field(
        default=0,
        ge=0,
    )

    units_sold: int = Field(
        default=0,
        ge=0,
    )

    @model_validator(mode="after")
    def validate_financial_totals(
        self,
    ) -> "ChannelSalesObservation":
        tolerance = max(
            0.05,
            self.gross_sales * 0.02,
        )

        expected_net = (
            self.gross_sales
            - self.discounts
            - self.refunds
        )

        if (
            abs(
                self.net_sales
                - expected_net
            )
            > tolerance
        ):
            raise ValueError(
                "Channel net_sales must approximately equal "
                "gross_sales minus discounts and refunds."
            )

        return self


class CategorySalesObservation(
    SalesForecastModel
):
    category_key: str = Field(
        min_length=1,
        max_length=120,
    )

    category_name: str = Field(
        min_length=1,
        max_length=160,
    )

    channel: SalesChannel

    gross_sales: float = Field(
        default=0,
        ge=0,
    )

    discounts: float = Field(
        default=0,
        ge=0,
    )

    refunds: float = Field(
        default=0,
        ge=0,
    )

    net_sales: float = 0

    cost_of_goods: float = Field(
        default=0,
        ge=0,
    )

    transactions: int = Field(
        default=0,
        ge=0,
    )

    units_sold: int = Field(
        default=0,
        ge=0,
    )

    @model_validator(mode="after")
    def validate_financial_totals(
        self,
    ) -> "CategorySalesObservation":
        tolerance = max(
            0.05,
            self.gross_sales * 0.02,
        )

        expected_net = (
            self.gross_sales
            - self.discounts
            - self.refunds
        )

        if (
            abs(
                self.net_sales
                - expected_net
            )
            > tolerance
        ):
            raise ValueError(
                "Category net_sales must approximately equal "
                "gross_sales minus discounts and refunds."
            )

        return self


class DailySalesObservation(
    SalesForecastModel
):
    business_date: date

    gross_sales: float = Field(
        default=0,
        ge=0,
    )

    discounts: float = Field(
        default=0,
        ge=0,
    )

    refunds: float = Field(
        default=0,
        ge=0,
    )

    net_sales: float = 0

    collected_sales: float = 0

    cost_of_goods: float = Field(
        default=0,
        ge=0,
    )

    transactions: int = Field(
        default=0,
        ge=0,
    )

    completed_appointments: int = Field(
        default=0,
        ge=0,
    )

    paid_orders: int = Field(
        default=0,
        ge=0,
    )

    units_sold: int = Field(
        default=0,
        ge=0,
    )

    service_sales: float = 0
    retail_sales: float = 0
    membership_sales: float = 0
    gift_card_sales: float = 0
    other_sales: float = 0

    channels: list[
        ChannelSalesObservation
    ] = Field(
        default_factory=list,
    )

    categories: list[
        CategorySalesObservation
    ] = Field(
        default_factory=list,
    )

    @model_validator(mode="after")
    def validate_daily_totals(
        self,
    ) -> "DailySalesObservation":
        tolerance = max(
            0.10,
            self.gross_sales * 0.02,
        )

        expected_net = (
            self.gross_sales
            - self.discounts
            - self.refunds
        )

        if (
            abs(
                self.net_sales
                - expected_net
            )
            > tolerance
        ):
            raise ValueError(
                "Daily net_sales must approximately equal "
                "gross_sales minus discounts and refunds."
            )

        channel_names = [
            item.channel
            for item in self.channels
        ]

        if (
            len(channel_names)
            != len(set(channel_names))
        ):
            raise ValueError(
                "Daily sales channels must be unique."
            )

        category_keys = [
            item.category_key
            for item in self.categories
        ]

        if (
            len(category_keys)
            != len(set(category_keys))
        ):
            raise ValueError(
                "Daily sales category keys must be unique."
            )

        declared_channel_total = (
            self.service_sales
            + self.retail_sales
            + self.membership_sales
            + self.gift_card_sales
            + self.other_sales
        )

        if (
            abs(
                declared_channel_total
                - self.net_sales
            )
            > tolerance
        ):
            raise ValueError(
                "Daily channel sales must approximately "
                "equal net_sales."
            )

        return self


class SalesForecastSettings(
    SalesForecastModel
):
    horizon_days: int = Field(
        default=90,
        ge=7,
        le=365,
    )

    minimum_history_days: int = Field(
        default=90,
        ge=28,
        le=730,
    )

    recent_window_days: int = Field(
        default=30,
        ge=7,
        le=180,
    )

    baseline_window_days: int = Field(
        default=180,
        ge=28,
        le=730,
    )

    confidence_level: float = Field(
        default=0.90,
        ge=0.50,
        le=0.99,
    )

    weekday_seasonality_weight: float = Field(
        default=0.55,
        ge=0,
        le=1,
    )

    recent_trend_weight: float = Field(
        default=0.45,
        ge=0,
        le=1,
    )

    scenario_adjustment: float = Field(
        default=0,
        ge=-0.50,
        le=0.50,
    )

    business_days: list[int] = Field(
        default_factory=lambda: [
            0,
            1,
            2,
            3,
            4,
            5,
        ]
    )

    include_profit_forecast: bool = True
    include_category_forecast: bool = True

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

    @field_validator("currency")
    @classmethod
    def normalise_currency(
        cls,
        value: str,
    ) -> str:
        return value.upper()

    @field_validator("business_days")
    @classmethod
    def validate_business_days(
        cls,
        value: list[int],
    ) -> list[int]:
        unique_days = sorted(
            set(value)
        )

        if not unique_days:
            raise ValueError(
                "At least one business day is required."
            )

        if any(
            day < 0 or day > 6
            for day in unique_days
        ):
            raise ValueError(
                "Business days must use integers "
                "from 0 to 6."
            )

        return unique_days

    @model_validator(mode="after")
    def validate_windows_and_weights(
        self,
    ) -> "SalesForecastSettings":
        if (
            self.recent_window_days
            > self.baseline_window_days
        ):
            raise ValueError(
                "recent_window_days cannot exceed "
                "baseline_window_days."
            )

        if (
            self.minimum_history_days
            < self.recent_window_days
        ):
            raise ValueError(
                "minimum_history_days cannot be shorter "
                "than recent_window_days."
            )

        weight_total = (
            self.weekday_seasonality_weight
            + self.recent_trend_weight
        )

        if (
            abs(weight_total - 1.0)
            > 0.001
        ):
            raise ValueError(
                "weekday_seasonality_weight and "
                "recent_trend_weight must total 1."
            )

        return self


class SalesForecastRequest(
    SalesForecastModel
):
    as_of_date: date

    observations: list[
        DailySalesObservation
    ] = Field(
        min_length=1,
        max_length=730,
    )

    settings: SalesForecastSettings = Field(
        default_factory=SalesForecastSettings,
    )

    @model_validator(mode="after")
    def validate_observation_period(
        self,
    ) -> "SalesForecastRequest":
        observation_dates = [
            item.business_date
            for item in self.observations
        ]

        if (
            len(observation_dates)
            != len(set(observation_dates))
        ):
            raise ValueError(
                "Sales observation dates must be unique."
            )

        if any(
            item > self.as_of_date
            for item in observation_dates
        ):
            raise ValueError(
                "Sales observations cannot occur "
                "after as_of_date."
            )

        if (
            self.settings.baseline_window_days
            > len(self.observations)
        ):
            raise ValueError(
                "baseline_window_days cannot exceed "
                "the number of observations."
            )

        return self


class ChannelSalesForecast(
    SalesForecastModel
):
    channel: SalesChannel

    predicted_net_sales: float = Field(
        ge=0,
    )

    predicted_transactions: float = Field(
        ge=0,
    )

    predicted_units_sold: float = Field(
        ge=0,
    )

    sales_share: float = Field(
        ge=0,
        le=1,
    )

    growth_rate: float

    trend: SalesTrend

    confidence: float = Field(
        ge=0,
        le=1,
    )


class CategorySalesForecast(
    SalesForecastModel
):
    category_key: str = Field(
        min_length=1,
        max_length=120,
    )

    category_name: str = Field(
        min_length=1,
        max_length=160,
    )

    channel: SalesChannel

    predicted_net_sales: float = Field(
        ge=0,
    )

    predicted_transactions: float = Field(
        ge=0,
    )

    predicted_units_sold: float = Field(
        ge=0,
    )

    sales_share: float = Field(
        ge=0,
        le=1,
    )

    growth_rate: float

    trend: SalesTrend

    confidence: float = Field(
        ge=0,
        le=1,
    )


class DailySalesForecast(
    SalesForecastModel
):
    forecast_date: date

    day_name: str = Field(
        min_length=1,
        max_length=20,
    )

    is_business_day: bool

    predicted_gross_sales: float = Field(
        ge=0,
    )

    predicted_discounts: float = Field(
        ge=0,
    )

    predicted_refunds: float = Field(
        ge=0,
    )

    predicted_net_sales: float = Field(
        ge=0,
    )

    predicted_collected_sales: float = Field(
        ge=0,
    )

    predicted_cost_of_goods: float = Field(
        ge=0,
    )

    predicted_gross_profit: float = Field(
        ge=0,
    )

    predicted_transactions: float = Field(
        ge=0,
    )

    predicted_service_sales: float = Field(
        ge=0,
    )

    predicted_retail_sales: float = Field(
        ge=0,
    )

    predicted_membership_sales: float = Field(
        ge=0,
    )

    predicted_gift_card_sales: float = Field(
        ge=0,
    )

    predicted_other_sales: float = Field(
        ge=0,
    )

    lower_bound: float = Field(
        ge=0,
    )

    upper_bound: float = Field(
        ge=0,
    )

    expected_growth_rate: float

    trend: SalesTrend
    sales_risk: SalesRisk

    is_peak_day: bool = False
    is_quiet_day: bool = False

    channel_forecasts: list[
        ChannelSalesForecast
    ] = Field(
        default_factory=list,
    )

    category_forecasts: list[
        CategorySalesForecast
    ] = Field(
        default_factory=list,
    )

    explanation: str = Field(
        min_length=1,
        max_length=2000,
    )

    @model_validator(mode="after")
    def validate_bounds(
        self,
    ) -> "DailySalesForecast":
        if (
            self.lower_bound
            > self.predicted_net_sales
        ):
            raise ValueError(
                "lower_bound cannot exceed "
                "predicted_net_sales."
            )

        if (
            self.upper_bound
            < self.predicted_net_sales
        ):
            raise ValueError(
                "upper_bound cannot be below "
                "predicted_net_sales."
            )

        return self


class MonthlySalesForecast(
    SalesForecastModel
):
    month: str = Field(
        pattern=r"^\d{4}-\d{2}$",
    )

    month_label: str = Field(
        min_length=1,
        max_length=50,
    )

    predicted_gross_sales: float = Field(
        ge=0,
    )

    predicted_net_sales: float = Field(
        ge=0,
    )

    predicted_service_sales: float = Field(
        ge=0,
    )

    predicted_retail_sales: float = Field(
        ge=0,
    )

    predicted_gross_profit: float = Field(
        ge=0,
    )

    predicted_transactions: float = Field(
        ge=0,
    )

    lower_bound: float = Field(
        ge=0,
    )

    upper_bound: float = Field(
        ge=0,
    )

    expected_growth_rate: float


class SalesForecastSummary(
    SalesForecastModel
):
    total_predicted_gross_sales: float = Field(
        ge=0,
    )

    total_predicted_net_sales: float = Field(
        ge=0,
    )

    total_predicted_collected_sales: float = Field(
        ge=0,
    )

    total_predicted_service_sales: float = Field(
        ge=0,
    )

    total_predicted_retail_sales: float = Field(
        ge=0,
    )

    total_predicted_membership_sales: float = Field(
        ge=0,
    )

    total_predicted_gift_card_sales: float = Field(
        ge=0,
    )

    total_predicted_other_sales: float = Field(
        ge=0,
    )

    total_predicted_cost_of_goods: float = Field(
        ge=0,
    )

    total_predicted_gross_profit: float = Field(
        ge=0,
    )

    total_predicted_transactions: float = Field(
        ge=0,
    )

    average_daily_net_sales: float = Field(
        ge=0,
    )

    average_transaction_value: float = Field(
        ge=0,
    )

    expected_growth_rate: float

    predicted_discount_rate: float = Field(
        ge=0,
        le=1,
    )

    predicted_refund_rate: float = Field(
        ge=0,
        le=1,
    )

    predicted_gross_margin: float = Field(
        ge=0,
        le=1,
    )

    peak_dates: list[date] = Field(
        default_factory=list,
    )

    quiet_dates: list[date] = Field(
        default_factory=list,
    )

    channel_insights: list[str] = Field(
        default_factory=list,
    )

    category_insights: list[str] = Field(
        default_factory=list,
    )

    risk_alerts: list[str] = Field(
        default_factory=list,
    )

    data_quality_warnings: list[str] = Field(
        default_factory=list,
    )


class SalesForecastResponse(
    SalesForecastModel
):
    generated_at: datetime
    as_of_date: date
    forecast_start: date
    forecast_end: date

    summary: SalesForecastSummary

    forecasts: list[
        DailySalesForecast
    ]

    monthly_forecasts: list[
        MonthlySalesForecast
    ] = Field(
        default_factory=list,
    )

    metadata: ServiceMetadata