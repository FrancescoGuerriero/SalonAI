from __future__ import annotations
from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.schemas.common import ServiceMetadata

RiskLevel = Literal["low", "medium", "high"]
ReminderStatus = Literal["none", "scheduled", "sent", "confirmed"]
DepositStatus = Literal["none", "requested", "paid", "refunded"]

class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

class AppointmentRiskObservation(Model):
    appointment_key: str = Field(min_length=1, max_length=120)
    customer_key: str = Field(min_length=1, max_length=120)
    appointment_date: datetime
    created_at: datetime | None = None
    service_name: str | None = Field(default=None, max_length=180)
    appointment_value: float = Field(default=0, ge=0)
    lead_time_days: float = Field(default=0, ge=0)
    previous_bookings: int = Field(default=0, ge=0)
    previous_completed: int = Field(default=0, ge=0)
    previous_no_shows: int = Field(default=0, ge=0)
    previous_cancellations: int = Field(default=0, ge=0)
    days_since_last_visit: int | None = Field(default=None, ge=0)
    reschedule_count: int = Field(default=0, ge=0)
    reminder_status: ReminderStatus = "none"
    deposit_status: DepositStatus = "none"
    is_new_customer: bool = False
    is_weekend: bool = False
    is_evening: bool = False

    @model_validator(mode="after")
    def validate_history(self):
        if self.previous_completed > self.previous_bookings:
            raise ValueError("previous_completed cannot exceed previous_bookings")
        if self.previous_no_shows > self.previous_bookings:
            raise ValueError("previous_no_shows cannot exceed previous_bookings")
        return self

class NoShowPredictionSettings(Model):
    high_risk_threshold: float = Field(default=0.65, ge=0, le=1)
    medium_risk_threshold: float = Field(default=0.35, ge=0, le=1)
    include_recommendations: bool = True

    @model_validator(mode="after")
    def validate_thresholds(self):
        if self.medium_risk_threshold >= self.high_risk_threshold:
            raise ValueError("medium_risk_threshold must be below high_risk_threshold")
        return self

class NoShowPredictionRequest(Model):
    as_of_date: date
    appointments: list[AppointmentRiskObservation] = Field(min_length=1, max_length=1000)
    settings: NoShowPredictionSettings = Field(default_factory=NoShowPredictionSettings)

    @model_validator(mode="after")
    def validate_unique(self):
        keys = [x.appointment_key for x in self.appointments]
        if len(keys) != len(set(keys)):
            raise ValueError("appointment_key values must be unique")
        return self

class NoShowRiskFactor(Model):
    code: str
    label: str
    contribution: float = Field(ge=-1, le=1)

class AppointmentNoShowPrediction(Model):
    appointment_key: str
    customer_key: str
    appointment_date: datetime
    service_name: str | None = None
    appointment_value: float = Field(ge=0)
    probability: float = Field(ge=0, le=1)
    risk_level: RiskLevel
    confidence: float = Field(ge=0, le=1)
    risk_factors: list[NoShowRiskFactor] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)

class NoShowPredictionSummary(Model):
    total_appointments: int = Field(ge=0)
    high_risk_count: int = Field(ge=0)
    medium_risk_count: int = Field(ge=0)
    low_risk_count: int = Field(ge=0)
    expected_no_shows: float = Field(ge=0)
    revenue_at_risk: float = Field(ge=0)
    average_probability: float = Field(ge=0, le=1)
    recommended_actions: list[str] = Field(default_factory=list)

class NoShowPredictionResponse(Model):
    generated_at: str
    as_of_date: date
    summary: NoShowPredictionSummary
    predictions: list[AppointmentNoShowPrediction]
    metadata: ServiceMetadata
