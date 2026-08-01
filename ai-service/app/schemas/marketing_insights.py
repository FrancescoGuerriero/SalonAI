from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)

from app.schemas.common import (
    ServiceMetadata,
)


MarketingChannel = Literal[
    "email",
    "sms",
    "whatsapp",
    "push",
    "social",
    "referral",
    "organic",
    "paid_search",
    "paid_social",
    "other",
]

CampaignStatus = Literal[
    "draft",
    "scheduled",
    "running",
    "completed",
    "paused",
    "cancelled",
]

MarketingTrend = Literal[
    "rising",
    "stable",
    "falling",
]

MarketingRisk = Literal[
    "high",
    "medium",
    "low",
    "balanced",
    "unknown",
]

InsightPriority = Literal[
    "critical",
    "high",
    "medium",
    "low",
]

InsightCategory = Literal[
    "acquisition",
    "engagement",
    "conversion",
    "retention",
    "revenue",
    "deliverability",
    "campaign",
    "channel",
    "data_quality",
]


class MarketingInsightsModel(
    BaseModel
):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class MarketingChannelObservation(
    MarketingInsightsModel
):
    channel: MarketingChannel

    audience_size: int = Field(
        default=0,
        ge=0,
    )

    messages_sent: int = Field(
        default=0,
        ge=0,
    )

    messages_delivered: int = Field(
        default=0,
        ge=0,
    )

    messages_opened: int = Field(
        default=0,
        ge=0,
    )

    messages_clicked: int = Field(
        default=0,
        ge=0,
    )

    enquiries: int = Field(
        default=0,
        ge=0,
    )

    bookings: int = Field(
        default=0,
        ge=0,
    )

    completed_appointments: int = Field(
        default=0,
        ge=0,
    )

    new_customers: int = Field(
        default=0,
        ge=0,
    )

    returning_customers: int = Field(
        default=0,
        ge=0,
    )

    unsubscribes: int = Field(
        default=0,
        ge=0,
    )

    failed_deliveries: int = Field(
        default=0,
        ge=0,
    )

    marketing_cost: float = Field(
        default=0,
        ge=0,
    )

    attributed_revenue: float = Field(
        default=0,
        ge=0,
    )

    discounts_redeemed: float = Field(
        default=0,
        ge=0,
    )

    refunds: float = Field(
        default=0,
        ge=0,
    )

    @model_validator(
        mode="after"
    )
    def validate_delivery_totals(
        self,
    ) -> "MarketingChannelObservation":
        if (
            self.messages_delivered
            >
            self.messages_sent
        ):
            raise ValueError(
                "messages_delivered cannot exceed messages_sent"
            )

        if (
            self.messages_opened
            >
            self.messages_delivered
        ):
            raise ValueError(
                "messages_opened cannot exceed messages_delivered"
            )

        if (
            self.messages_clicked
            >
            self.messages_opened
        ):
            raise ValueError(
                "messages_clicked cannot exceed messages_opened"
            )

        if (
            self.failed_deliveries
            >
            self.messages_sent
        ):
            raise ValueError(
                "failed_deliveries cannot exceed messages_sent"
            )

        if (
            self.unsubscribes
            >
            self.messages_delivered
        ):
            raise ValueError(
                "unsubscribes cannot exceed messages_delivered"
            )

        return self


class CampaignObservation(
    MarketingInsightsModel
):
    campaign_key: str = Field(
        min_length=1,
        max_length=120,
    )

    campaign_name: str = Field(
        min_length=1,
        max_length=180,
    )

    channel: MarketingChannel

    status: CampaignStatus = "completed"

    audience_segment: str | None = Field(
        default=None,
        max_length=160,
    )

    started_on: date | None = None

    ended_on: date | None = None

    audience_size: int = Field(
        default=0,
        ge=0,
    )

    messages_sent: int = Field(
        default=0,
        ge=0,
    )

    messages_delivered: int = Field(
        default=0,
        ge=0,
    )

    messages_opened: int = Field(
        default=0,
        ge=0,
    )

    messages_clicked: int = Field(
        default=0,
        ge=0,
    )

    bookings: int = Field(
        default=0,
        ge=0,
    )

    completed_appointments: int = Field(
        default=0,
        ge=0,
    )

    new_customers: int = Field(
        default=0,
        ge=0,
    )

    returning_customers: int = Field(
        default=0,
        ge=0,
    )

    unsubscribes: int = Field(
        default=0,
        ge=0,
    )

    failed_deliveries: int = Field(
        default=0,
        ge=0,
    )

    marketing_cost: float = Field(
        default=0,
        ge=0,
    )

    attributed_revenue: float = Field(
        default=0,
        ge=0,
    )

    discounts_redeemed: float = Field(
        default=0,
        ge=0,
    )

    refunds: float = Field(
        default=0,
        ge=0,
    )

    @model_validator(
        mode="after"
    )
    def validate_campaign(
        self,
    ) -> "CampaignObservation":
        if (
            self.started_on
            and self.ended_on
            and self.ended_on
            <
            self.started_on
        ):
            raise ValueError(
                "ended_on cannot occur before started_on"
            )

        if (
            self.messages_delivered
            >
            self.messages_sent
        ):
            raise ValueError(
                "messages_delivered cannot exceed messages_sent"
            )

        if (
            self.messages_opened
            >
            self.messages_delivered
        ):
            raise ValueError(
                "messages_opened cannot exceed messages_delivered"
            )

        if (
            self.messages_clicked
            >
            self.messages_opened
        ):
            raise ValueError(
                "messages_clicked cannot exceed messages_opened"
            )

        if (
            self.failed_deliveries
            >
            self.messages_sent
        ):
            raise ValueError(
                "failed_deliveries cannot exceed messages_sent"
            )

        if (
            self.unsubscribes
            >
            self.messages_delivered
        ):
            raise ValueError(
                "unsubscribes cannot exceed messages_delivered"
            )

        return self


class DailyMarketingObservation(
    MarketingInsightsModel
):
    business_date: date

    active_customers: int = Field(
        default=0,
        ge=0,
    )

    new_customers: int = Field(
        default=0,
        ge=0,
    )

    returning_customers: int = Field(
        default=0,
        ge=0,
    )

    enquiries: int = Field(
        default=0,
        ge=0,
    )

    bookings: int = Field(
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

    messages_sent: int = Field(
        default=0,
        ge=0,
    )

    messages_delivered: int = Field(
        default=0,
        ge=0,
    )

    messages_opened: int = Field(
        default=0,
        ge=0,
    )

    messages_clicked: int = Field(
        default=0,
        ge=0,
    )

    unsubscribes: int = Field(
        default=0,
        ge=0,
    )

    failed_deliveries: int = Field(
        default=0,
        ge=0,
    )

    marketing_cost: float = Field(
        default=0,
        ge=0,
    )

    attributed_revenue: float = Field(
        default=0,
        ge=0,
    )

    total_revenue: float = Field(
        default=0,
        ge=0,
    )

    discounts_redeemed: float = Field(
        default=0,
        ge=0,
    )

    refunds: float = Field(
        default=0,
        ge=0,
    )

    channels: list[
        MarketingChannelObservation
    ] = Field(
        default_factory=list,
        max_length=20,
    )

    campaigns: list[
        CampaignObservation
    ] = Field(
        default_factory=list,
        max_length=100,
    )

    @model_validator(
        mode="after"
    )
    def validate_daily_totals(
        self,
    ) -> "DailyMarketingObservation":
        if (
            self.messages_delivered
            >
            self.messages_sent
        ):
            raise ValueError(
                "messages_delivered cannot exceed messages_sent"
            )

        if (
            self.messages_opened
            >
            self.messages_delivered
        ):
            raise ValueError(
                "messages_opened cannot exceed messages_delivered"
            )

        if (
            self.messages_clicked
            >
            self.messages_opened
        ):
            raise ValueError(
                "messages_clicked cannot exceed messages_opened"
            )

        if (
            self.failed_deliveries
            >
            self.messages_sent
        ):
            raise ValueError(
                "failed_deliveries cannot exceed messages_sent"
            )

        if (
            self.unsubscribes
            >
            self.messages_delivered
        ):
            raise ValueError(
                "unsubscribes cannot exceed messages_delivered"
            )

        channel_names = [
            channel.channel
            for channel in self.channels
        ]

        if (
            len(channel_names)
            !=
            len(set(channel_names))
        ):
            raise ValueError(
                "Marketing channels must be unique within each day"
            )

        campaign_keys = [
            campaign.campaign_key
            for campaign in self.campaigns
        ]

        if (
            len(campaign_keys)
            !=
            len(set(campaign_keys))
        ):
            raise ValueError(
                "Campaign keys must be unique within each day"
            )

        return self


class MarketingInsightsSettings(
    MarketingInsightsModel
):
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

    minimum_history_days: int = Field(
        default=90,
        ge=28,
        le=730,
    )

    minimum_campaign_messages: int = Field(
        default=20,
        ge=1,
        le=100_000,
    )

    minimum_channel_messages: int = Field(
        default=30,
        ge=1,
        le=100_000,
    )

    strong_open_rate: float = Field(
        default=0.35,
        ge=0,
        le=1,
    )

    strong_click_rate: float = Field(
        default=0.08,
        ge=0,
        le=1,
    )

    strong_conversion_rate: float = Field(
        default=0.05,
        ge=0,
        le=1,
    )

    high_unsubscribe_rate: float = Field(
        default=0.02,
        ge=0,
        le=1,
    )

    high_failure_rate: float = Field(
        default=0.08,
        ge=0,
        le=1,
    )

    include_campaign_insights: bool = True

    include_channel_insights: bool = True

    include_recommendations: bool = True

    currency: Literal[
        "GBP"
    ] = "GBP"

    timezone: Literal[
        "Europe/London"
    ] = "Europe/London"

    @model_validator(
        mode="after"
    )
    def validate_windows(
        self,
    ) -> "MarketingInsightsSettings":
        if (
            self.recent_window_days
            >
            self.baseline_window_days
        ):
            raise ValueError(
                "recent_window_days cannot exceed baseline_window_days"
            )

        if (
            self.minimum_history_days
            >
            self.baseline_window_days
        ):
            raise ValueError(
                "minimum_history_days cannot exceed baseline_window_days"
            )

        return self


class MarketingInsightsRequest(
    MarketingInsightsModel
):
    as_of_date: date

    observations: list[
        DailyMarketingObservation
    ] = Field(
        min_length=1,
        max_length=730,
    )

    settings: MarketingInsightsSettings = Field(
        default_factory=MarketingInsightsSettings
    )

    @model_validator(
        mode="after"
    )
    def validate_request(
        self,
    ) -> "MarketingInsightsRequest":
        observation_dates = [
            observation.business_date
            for observation in self.observations
        ]

        if (
            len(observation_dates)
            !=
            len(set(observation_dates))
        ):
            raise ValueError(
                "Marketing observation dates must be unique"
            )

        future_dates = [
            value
            for value in observation_dates
            if value > self.as_of_date
        ]

        if future_dates:
            raise ValueError(
                "Marketing observations cannot occur after as_of_date"
            )

        if (
            len(self.observations)
            <
            self.settings.recent_window_days
        ):
            raise ValueError(
                "The observation history must cover recent_window_days"
            )

        if (
            len(self.observations)
            <
            self.settings.baseline_window_days
        ):
            raise ValueError(
                "The observation history must cover baseline_window_days"
            )

        return self


class MarketingRateMetrics(
    MarketingInsightsModel
):
    delivery_rate: float = Field(
        ge=0,
        le=1,
    )

    open_rate: float = Field(
        ge=0,
        le=1,
    )

    click_rate: float = Field(
        ge=0,
        le=1,
    )

    click_to_open_rate: float = Field(
        ge=0,
        le=1,
    )

    booking_conversion_rate: float = Field(
        ge=0,
        le=1,
    )

    completed_conversion_rate: float = Field(
        ge=0,
        le=1,
    )

    unsubscribe_rate: float = Field(
        ge=0,
        le=1,
    )

    failure_rate: float = Field(
        ge=0,
        le=1,
    )

    new_customer_rate: float = Field(
        ge=0,
        le=1,
    )


class MarketingValueMetrics(
    MarketingInsightsModel
):
    marketing_cost: float = Field(
        ge=0,
    )

    attributed_revenue: float = Field(
        ge=0,
    )

    net_attributed_revenue: float = Field(
        ge=0,
    )

    return_on_marketing_spend: float = Field(
        ge=0,
    )

    cost_per_booking: float = Field(
        ge=0,
    )

    cost_per_completed_appointment: float = Field(
        ge=0,
    )

    revenue_per_message: float = Field(
        ge=0,
    )

    revenue_per_booking: float = Field(
        ge=0,
    )


class ChannelMarketingInsight(
    MarketingInsightsModel
):
    channel: MarketingChannel

    audience_size: int = Field(
        ge=0,
    )

    messages_sent: int = Field(
        ge=0,
    )

    messages_delivered: int = Field(
        ge=0,
    )

    messages_opened: int = Field(
        ge=0,
    )

    messages_clicked: int = Field(
        ge=0,
    )

    bookings: int = Field(
        ge=0,
    )

    completed_appointments: int = Field(
        ge=0,
    )

    new_customers: int = Field(
        ge=0,
    )

    rates: MarketingRateMetrics

    value: MarketingValueMetrics

    engagement_trend: MarketingTrend

    conversion_trend: MarketingTrend

    revenue_trend: MarketingTrend

    risk: MarketingRisk

    confidence: float = Field(
        ge=0,
        le=1,
    )

    strengths: list[str] = Field(
        default_factory=list,
        max_length=10,
    )

    weaknesses: list[str] = Field(
        default_factory=list,
        max_length=10,
    )


class CampaignMarketingInsight(
    MarketingInsightsModel
):
    campaign_key: str = Field(
        min_length=1,
        max_length=120,
    )

    campaign_name: str = Field(
        min_length=1,
        max_length=180,
    )

    channel: MarketingChannel

    status: CampaignStatus

    audience_segment: str | None = Field(
        default=None,
        max_length=160,
    )

    started_on: date | None = None

    ended_on: date | None = None

    audience_size: int = Field(
        ge=0,
    )

    messages_sent: int = Field(
        ge=0,
    )

    bookings: int = Field(
        ge=0,
    )

    completed_appointments: int = Field(
        ge=0,
    )

    new_customers: int = Field(
        ge=0,
    )

    rates: MarketingRateMetrics

    value: MarketingValueMetrics

    performance_score: float = Field(
        ge=0,
        le=100,
    )

    trend: MarketingTrend

    risk: MarketingRisk

    confidence: float = Field(
        ge=0,
        le=1,
    )

    strengths: list[str] = Field(
        default_factory=list,
        max_length=10,
    )

    weaknesses: list[str] = Field(
        default_factory=list,
        max_length=10,
    )


class MarketingInsight(
    MarketingInsightsModel
):
    insight_id: str = Field(
        min_length=1,
        max_length=120,
    )

    category: InsightCategory

    priority: InsightPriority

    title: str = Field(
        min_length=1,
        max_length=180,
    )

    description: str = Field(
        min_length=1,
        max_length=1_000,
    )

    evidence: list[str] = Field(
        default_factory=list,
        max_length=10,
    )

    recommended_action: str | None = Field(
        default=None,
        max_length=1_000,
    )

    affected_channel: MarketingChannel | None = None

    affected_campaign_key: str | None = Field(
        default=None,
        max_length=120,
    )

    estimated_impact: str | None = Field(
        default=None,
        max_length=500,
    )


class MarketingInsightsSummary(
    MarketingInsightsModel
):
    total_audience_size: int = Field(
        ge=0,
    )

    total_messages_sent: int = Field(
        ge=0,
    )

    total_messages_delivered: int = Field(
        ge=0,
    )

    total_messages_opened: int = Field(
        ge=0,
    )

    total_messages_clicked: int = Field(
        ge=0,
    )

    total_enquiries: int = Field(
        ge=0,
    )

    total_bookings: int = Field(
        ge=0,
    )

    total_completed_appointments: int = Field(
        ge=0,
    )

    total_new_customers: int = Field(
        ge=0,
    )

    total_returning_customers: int = Field(
        ge=0,
    )

    total_unsubscribes: int = Field(
        ge=0,
    )

    total_failed_deliveries: int = Field(
        ge=0,
    )

    rates: MarketingRateMetrics

    value: MarketingValueMetrics

    engagement_trend: MarketingTrend

    conversion_trend: MarketingTrend

    revenue_trend: MarketingTrend

    overall_risk: MarketingRisk

    best_channel: MarketingChannel | None = None

    weakest_channel: MarketingChannel | None = None

    best_campaign_key: str | None = Field(
        default=None,
        max_length=120,
    )

    weakest_campaign_key: str | None = Field(
        default=None,
        max_length=120,
    )

    key_findings: list[str] = Field(
        default_factory=list,
        max_length=20,
    )

    recommended_actions: list[str] = Field(
        default_factory=list,
        max_length=20,
    )

    risk_alerts: list[str] = Field(
        default_factory=list,
        max_length=20,
    )

    data_quality_warnings: list[str] = Field(
        default_factory=list,
        max_length=20,
    )


class MarketingInsightsResponse(
    MarketingInsightsModel
):
    generated_at: str

    as_of_date: date

    analysis_start: date

    analysis_end: date

    summary: MarketingInsightsSummary

    channel_insights: list[
        ChannelMarketingInsight
    ] = Field(
        default_factory=list,
        max_length=20,
    )

    campaign_insights: list[
        CampaignMarketingInsight
    ] = Field(
        default_factory=list,
        max_length=200,
    )

    insights: list[
        MarketingInsight
    ] = Field(
        default_factory=list,
        max_length=100,
    )

    metadata: ServiceMetadata