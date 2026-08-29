from enum import Enum
from typing import Literal

from pydantic import (
    BaseModel,
    Field,
    field_validator,
)


class WhatsAppBotIntent(
    str,
    Enum,
):
    BOOKING = "booking"
    PRICE = "price"
    SERVICES = "services"
    OPENING_HOURS = "opening_hours"
    RESCHEDULE = "reschedule"
    CANCELLATION = "cancellation"
    HUMAN_HANDOFF = "human_handoff"
    GREETING = "greeting"
    UNKNOWN = "unknown"


class WhatsAppBotEntities(
    BaseModel,
):
    service_name: str = ""
    stylist_name: str = ""
    date_text: str = ""
    time_text: str = ""
    customer_name: str = ""


class WhatsAppBotAnalysisRequest(
    BaseModel,
):
    message: str = Field(
        min_length=1,
        max_length=4096,
    )

    current_stage: Literal[
        "idle",
        "service",
        "stylist",
        "date",
        "time",
        "review",
        "confirmed",
    ] = "idle"

    services: list[str] = Field(
        default_factory=list,
        max_length=200,
    )

    stylists: list[str] = Field(
        default_factory=list,
        max_length=100,
    )

    locale: str = Field(
        default="en-GB",
        max_length=20,
    )

    @field_validator(
        "message",
        "locale",
    )
    @classmethod
    def normalise_text(
        cls,
        value: str,
    ) -> str:
        return " ".join(
            str(value)
            .strip()
            .split()
        )

    @field_validator(
        "services",
        "stylists",
    )
    @classmethod
    def normalise_names(
        cls,
        values: list[str],
    ) -> list[str]:
        result: list[str] = []

        for value in values:
            normalised = " ".join(
                str(value)
                .strip()
                .split()
            )

            if (
                normalised
                and normalised
                not in result
            ):
                result.append(
                    normalised
                )

        return result


class WhatsAppBotAnalysisResponse(
    BaseModel,
):
    intent: WhatsAppBotIntent

    confidence: float = Field(
        ge=0,
        le=1,
    )

    entities: WhatsAppBotEntities

    next_action: Literal[
        "greet",
        "collect_service",
        "collect_stylist",
        "collect_date",
        "collect_time",
        "check_availability",
        "answer_information",
        "handoff",
        "ask_clarification",
    ]

    requires_human: bool = False

    reply_suggestion: str = Field(
        min_length=1,
        max_length=1000,
    )

    provider_mode: str

    model_name: str

    rules_applied: list[str] = Field(
        default_factory=list,
    )