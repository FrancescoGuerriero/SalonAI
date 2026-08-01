from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ServiceMetadata


class CustomerMetrics(BaseModel):
    visit_count: int = Field(default=0, ge=0)
    completed_appointments: int = Field(default=0, ge=0)
    cancelled_appointments: int = Field(default=0, ge=0)
    no_show_appointments: int = Field(default=0, ge=0)
    total_spent: float = Field(default=0, ge=0)
    average_spend: float = Field(default=0, ge=0)
    loyalty_points: int = Field(default=0, ge=0)


class CustomerHairProfile(BaseModel):
    hair_type: str = Field(default="", max_length=100)
    texture: str = Field(default="", max_length=100)
    density: str = Field(default="", max_length=100)
    porosity: str = Field(default="", max_length=100)
    current_hair_colour: str = Field(default="", max_length=100)
    scalp_condition: str = Field(default="", max_length=500)
    concerns: list[str] = Field(default_factory=list, max_length=20)
    allergies: list[str] = Field(default_factory=list, max_length=20)
    sensitivities: list[str] = Field(default_factory=list, max_length=20)
    preferred_products: list[str] = Field(default_factory=list, max_length=20)
    products_to_avoid: list[str] = Field(default_factory=list, max_length=20)
    chemical_history: str = Field(default="", max_length=2000)
    patch_test_result: str = Field(default="", max_length=50)
    last_patch_test_at: datetime | None = None


class BookingPreferences(BaseModel):
    preferred_days: list[str] = Field(default_factory=list, max_length=7)
    preferred_time_of_day: str = Field(default="", max_length=50)
    preferred_reminder_channel: str = Field(default="", max_length=50)
    accessibility_requirements: str = Field(default="", max_length=1000)
    additional_requirements: str = Field(default="", max_length=1000)


class AppointmentSnapshot(BaseModel):
    appointment_id: str = Field(default="", max_length=100)
    status: str = Field(default="", max_length=50)
    appointment_date: datetime | None = None
    appointment_time: str = Field(default="", max_length=20)
    service_name: str = Field(default="", max_length=200)
    stylist_name: str = Field(default="", max_length=200)
    final_price: float = Field(default=0, ge=0)
    amount_paid: float = Field(default=0, ge=0)
    balance_due: float = Field(default=0, ge=0)
    notes: str = Field(default="", max_length=500)


class CustomerNoteSnapshot(BaseModel):
    note_type: str = Field(default="general", max_length=50)
    title: str = Field(default="", max_length=150)
    content: str = Field(default="", max_length=1200)
    pinned: bool = False
    requires_follow_up: bool = False
    follow_up_at: datetime | None = None
    follow_up_completed: bool = False
    created_at: datetime | None = None


class ProductOrderSnapshot(BaseModel):
    order_number: str = Field(default="", max_length=100)
    status: str = Field(default="", max_length=50)
    total: float = Field(default=0, ge=0)
    created_at: datetime | None = None
    products: list[str] = Field(default_factory=list, max_length=20)


class CustomerSummaryRequest(BaseModel):
    customer_id: str = Field(min_length=1, max_length=100)
    display_name: str = Field(min_length=1, max_length=200)
    customer_status: str = Field(default="active", max_length=50)
    loyalty_tier: str = Field(default="standard", max_length=50)
    membership_status: str = Field(default="none", max_length=50)
    metrics: CustomerMetrics = Field(default_factory=CustomerMetrics)
    hair_profile: CustomerHairProfile = Field(default_factory=CustomerHairProfile)
    booking_preferences: BookingPreferences = Field(default_factory=BookingPreferences)
    preferred_services: list[str] = Field(default_factory=list, max_length=20)
    preferred_stylist: str = Field(default="", max_length=200)
    upcoming_appointments: list[AppointmentSnapshot] = Field(default_factory=list, max_length=8)
    recent_appointments: list[AppointmentSnapshot] = Field(default_factory=list, max_length=20)
    recent_notes: list[CustomerNoteSnapshot] = Field(default_factory=list, max_length=12)
    recent_orders: list[ProductOrderSnapshot] = Field(default_factory=list, max_length=10)
    summary_style: Literal["concise", "detailed"] = "detailed"

    @field_validator("preferred_services")
    @classmethod
    def remove_duplicate_services(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(item.strip() for item in values if item.strip()))


class CustomerSummaryResponse(BaseModel):
    headline: str
    executive_summary: str
    key_preferences: list[str]
    service_history_insights: list[str]
    hair_and_safety_notes: list[str]
    relationship_actions: list[str]
    upcoming_appointment_focus: list[str]
    product_insights: list[str]
    data_quality_gaps: list[str]
    confidence: float = Field(ge=0, le=1)
    metadata: ServiceMetadata
