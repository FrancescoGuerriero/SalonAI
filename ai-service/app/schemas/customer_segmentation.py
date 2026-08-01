from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ServiceMetadata


SegmentKey = Literal[
    "active",
    "new",
    "loyal",
    "high_value",
    "inactive",
    "discount_sensitive",
    "at_risk",
]


class CustomerSegmentFeatures(BaseModel):
    customer_ref: str = Field(min_length=1, max_length=100)
    account_age_days: int = Field(default=0, ge=0, le=36500)
    completed_appointments: int = Field(default=0, ge=0)
    cancelled_appointments: int = Field(default=0, ge=0)
    no_show_appointments: int = Field(default=0, ge=0)
    upcoming_appointments: int = Field(default=0, ge=0)
    days_since_last_visit: int | None = Field(default=None, ge=0, le=36500)
    days_until_next_appointment: int | None = Field(default=None, ge=0, le=36500)
    service_spend: float = Field(default=0, ge=0)
    retail_spend: float = Field(default=0, ge=0)
    average_service_spend: float = Field(default=0, ge=0)
    discount_total: float = Field(default=0, ge=0)
    discount_usage_rate: float = Field(default=0, ge=0, le=1)
    rebooking_rate: float = Field(default=0, ge=0, le=1)
    marketing_engagement_rate: float = Field(default=0, ge=0, le=1)
    contact_attempts: int = Field(default=0, ge=0)
    product_orders: int = Field(default=0, ge=0)
    loyalty_points: int = Field(default=0, ge=0)
    has_marketing_consent: bool = False
    preferred_channel: str = Field(default="none", max_length=50)


class SegmentationThresholds(BaseModel):
    new_customer_days: int = Field(default=45, ge=7, le=180)
    loyal_completed_visits: int = Field(default=6, ge=2, le=50)
    loyal_rebooking_rate: float = Field(default=0.60, ge=0, le=1)
    high_value_spend: float = Field(default=750, ge=0)
    high_value_average_spend: float = Field(default=120, ge=0)
    inactive_days: int = Field(default=180, ge=60, le=730)
    at_risk_days: int = Field(default=90, ge=30, le=365)
    discount_usage_rate: float = Field(default=0.50, ge=0, le=1)


class CustomerSegmentationRequest(BaseModel):
    customers: list[CustomerSegmentFeatures] = Field(
        min_length=1,
        max_length=500,
    )
    thresholds: SegmentationThresholds = Field(
        default_factory=SegmentationThresholds
    )

    @field_validator("customers")
    @classmethod
    def require_unique_references(
        cls,
        values: list[CustomerSegmentFeatures],
    ) -> list[CustomerSegmentFeatures]:
        references = [item.customer_ref for item in values]
        if len(references) != len(set(references)):
            raise ValueError("customer_ref values must be unique")
        return values


class CustomerSegmentResult(BaseModel):
    customer_ref: str
    primary_segment: SegmentKey
    segments: list[SegmentKey]
    value_score: float = Field(ge=0, le=1)
    risk_score: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    signals: list[str]
    explanation: str
    recommended_action: str
    recommended_channel: str


class SegmentCount(BaseModel):
    key: SegmentKey
    count: int = Field(ge=0)


class CustomerSegmentationResponse(BaseModel):
    customers: list[CustomerSegmentResult]
    segment_counts: list[SegmentCount]
    thresholds: SegmentationThresholds
    metadata: ServiceMetadata
