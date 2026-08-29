from __future__ import annotations

import re

from app.schemas.whatsapp_bot import (
    WhatsAppBotAnalysisRequest,
    WhatsAppBotAnalysisResponse,
    WhatsAppBotEntities,
    WhatsAppBotIntent,
)


WEEKDAYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)


def _normalise(
    value: str,
) -> str:
    return " ".join(
        str(value)
        .strip()
        .lower()
        .split()
    )


def _contains_any(
    text: str,
    phrases: tuple[str, ...],
) -> bool:
    return any(
        phrase in text
        for phrase in phrases
    )


def _match_known_name(
    message: str,
    values: list[str],
) -> str:
    normalised_message = (
        _normalise(message)
    )

    ordered = sorted(
        values,
        key=len,
        reverse=True,
    )

    for value in ordered:
        if (
            _normalise(value)
            in normalised_message
        ):
            return value

    return ""


def _extract_date_text(
    message: str,
) -> str:
    lowered = _normalise(
        message
    )

    absolute_patterns = (
        r"\b\d{4}-\d{2}-\d{2}\b",
        r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
        (
            r"\b\d{1,2}\s+"
            r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|"
            r"apr(?:il)?|may|jun(?:e)?|jul(?:y)?|"
            r"aug(?:ust)?|sep(?:t(?:ember)?|tember)?|"
            r"oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
            r"(?:\s+\d{4})?\b"
        ),
    )

    for pattern in absolute_patterns:
        match = re.search(
            pattern,
            message,
            flags=re.IGNORECASE,
        )

        if match:
            return match.group(0)

    if "tomorrow" in lowered:
        return "tomorrow"

    if "today" in lowered:
        return "today"

    for weekday in WEEKDAYS:
        next_phrase = (
            f"next {weekday}"
        )

        if next_phrase in lowered:
            return next_phrase

        if re.search(
            rf"\b{weekday}\b",
            lowered,
        ):
            return weekday

    return ""


def _extract_time_text(
    message: str,
) -> str:
    patterns = (
        r"\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b",
        r"\b(?:1[0-2]|0?[1-9])\s?(?:am|pm)\b",
        r"\b(?:morning|afternoon|evening)\b",
    )

    for pattern in patterns:
        match = re.search(
            pattern,
            message,
            flags=re.IGNORECASE,
        )

        if match:
            return (
                match.group(0)
                .strip()
            )

    return ""


def _extract_customer_name(
    message: str,
) -> str:
    match = re.search(
        r"\bmy name is\s+([A-Za-z][A-Za-z' -]{0,79})",
        message,
        flags=re.IGNORECASE,
    )

    if not match:
        return ""

    value = (
        match.group(1)
        .strip()
    )

    value = re.split(
        r"[,.!?]",
        value,
        maxsplit=1,
    )[0].strip()

    return value[:80]


def _classify_intent(
    message: str,
) -> tuple[
    WhatsAppBotIntent,
    float,
    list[str],
]:
    text = _normalise(
        message
    )

    if _contains_any(
        text,
        (
            "speak to a person",
            "speak to someone",
            "speak to staff",
            "talk to a person",
            "talk to someone",
            "human",
            "real person",
            "member of staff",
        ),
    ):
        return (
            WhatsAppBotIntent.HUMAN_HANDOFF,
            0.98,
            ["human-handoff-keyword"],
        )

    if _contains_any(
        text,
        (
            "cancel my appointment",
            "cancel appointment",
            "cancel booking",
            "cancel my booking",
            "i need to cancel",
        ),
    ):
        return (
            WhatsAppBotIntent.CANCELLATION,
            0.97,
            ["cancellation-keyword"],
        )

    if _contains_any(
        text,
        (
            "reschedule",
            "move my appointment",
            "move my booking",
            "change my appointment",
            "change my booking",
        ),
    ):
        return (
            WhatsAppBotIntent.RESCHEDULE,
            0.97,
            ["reschedule-keyword"],
        )

    if _contains_any(
        text,
        (
            "how much",
            "price",
            "prices",
            "cost",
            "costs",
        ),
    ):
        return (
            WhatsAppBotIntent.PRICE,
            0.92,
            ["price-keyword"],
        )

    if _contains_any(
        text,
        (
            "opening hours",
            "what time do you open",
            "what time do you close",
            "when do you open",
            "when are you open",
            "are you open",
        ),
    ):
        return (
            WhatsAppBotIntent.OPENING_HOURS,
            0.92,
            ["opening-hours-keyword"],
        )

    if _contains_any(
        text,
        (
            "what services",
            "which services",
            "what treatments",
            "which treatments",
            "do you offer",
            "do you do",
        ),
    ):
        return (
            WhatsAppBotIntent.SERVICES,
            0.88,
            ["services-keyword"],
        )

    if _contains_any(
        text,
        (
            "book",
            "booking",
            "appointment",
            "availability",
            "available",
            "slot",
            "come in for",
        ),
    ):
        return (
            WhatsAppBotIntent.BOOKING,
            0.94,
            ["booking-keyword"],
        )

    if text in {
        "hi",
        "hello",
        "hey",
        "good morning",
        "good afternoon",
        "good evening",
    }:
        return (
            WhatsAppBotIntent.GREETING,
            0.99,
            ["greeting"],
        )

    return (
        WhatsAppBotIntent.UNKNOWN,
        0.35,
        ["no-intent-rule-matched"],
    )


def _booking_next_action(
    entities: WhatsAppBotEntities,
    current_stage: str = "idle",
) -> tuple[str, str]:
    if (
        current_stage == "service"
        and entities.service_name
    ):
        return (
            "collect_stylist",
            (
                "Which stylist would you prefer? "
                "You can also say any available stylist."
            ),
        )

    if (
        current_stage == "stylist"
        and entities.stylist_name
    ):
        return (
            "collect_date",
            (
                "What date would you prefer "
                "for your appointment?"
            ),
        )

    if (
        current_stage == "date"
        and entities.date_text
    ):
        return (
            "collect_time",
            (
                "What time would you prefer? "
                "You can also say morning, "
                "afternoon or evening."
            ),
        )

    if (
        current_stage == "time"
        and entities.time_text
    ):
        return (
            "check_availability",
            (
                "Thanks. I have enough information "
                "to check live availability. "
                "I will verify the slot before "
                "anything is booked."
            ),
        )

    if not entities.service_name:
        return (
            "collect_service",
            (
                "Of course. Which service would "
                "you like to book?"
            ),
        )

    if not entities.stylist_name:
        return (
            "collect_stylist",
            (
                "Which stylist would you prefer? "
                "You can also say any available stylist."
            ),
        )

    if not entities.date_text:
        return (
            "collect_date",
            (
                "What date would you prefer "
                "for your appointment?"
            ),
        )

    if not entities.time_text:
        return (
            "collect_time",
            (
                "What time would you prefer? "
                "You can also say morning, "
                "afternoon or evening."
            ),
        )

    return (
        "check_availability",
        (
            "Thanks. I have enough information "
            "to check live availability. "
            "I will verify the slot before "
            "anything is booked."
        ),
    )


def analyse_whatsapp_message(
    payload: WhatsAppBotAnalysisRequest,
    *,
    provider_mode: str = "mock",
) -> WhatsAppBotAnalysisResponse:
    intent, confidence, rules = (
        _classify_intent(
            payload.message
        )
    )

    stylist_name = (
        "Any available stylist"
        if _contains_any(
            _normalise(
                payload.message
            ),
            (
                "any stylist",
                "any available stylist",
                "anyone available",
                "whoever is available",
            ),
        )
        else _match_known_name(
            payload.message,
            payload.stylists,
        )
    )

    entities = (
        WhatsAppBotEntities(
            service_name=
                _match_known_name(
                    payload.message,
                    payload.services,
                ),

            stylist_name=
                stylist_name,

            date_text=
                _extract_date_text(
                    payload.message
                ),

            time_text=
                _extract_time_text(
                    payload.message
                ),

            customer_name=
                _extract_customer_name(
                    payload.message
                ),
        )
    )

    if entities.service_name:
        rules.append(
            "known-service-match"
        )

    if entities.stylist_name:
        rules.append(
            "known-stylist-match"
        )

    if entities.date_text:
        rules.append(
            "date-extracted"
        )

    if entities.time_text:
        rules.append(
            "time-extracted"
        )

    stage_booking_signal = (
        (
            payload.current_stage
            == "service"
            and bool(
                entities.service_name
            )
        )
        or (
            payload.current_stage
            == "stylist"
            and bool(
                entities.stylist_name
            )
        )
        or (
            payload.current_stage
            == "date"
            and bool(
                entities.date_text
            )
        )
        or (
            payload.current_stage
            == "time"
            and bool(
                entities.time_text
            )
        )
    )

    if (
        intent
        == WhatsAppBotIntent.UNKNOWN
        and stage_booking_signal
    ):
        intent = (
            WhatsAppBotIntent.BOOKING
        )
        confidence = 0.99
        rules.append(
            "booking-stage-context"
        )

    if (
        intent
        == WhatsAppBotIntent.BOOKING
    ):
        (
            next_action,
            reply,
        ) = _booking_next_action(
            entities,
            payload.current_stage,
        )

        requires_human = False

    elif intent in {
        WhatsAppBotIntent.CANCELLATION,
        WhatsAppBotIntent.RESCHEDULE,
        WhatsAppBotIntent.HUMAN_HANDOFF,
    }:
        next_action = "handoff"

        requires_human = True

        if (
            intent
            == WhatsAppBotIntent.CANCELLATION
        ):
            reply = (
                "I can help with that. "
                "I will pass your cancellation "
                "request to the salon team so "
                "they can verify the appointment."
            )

        elif (
            intent
            == WhatsAppBotIntent.RESCHEDULE
        ):
            reply = (
                "I can help with that. "
                "I will pass your rescheduling "
                "request to the salon team so "
                "the existing appointment can "
                "be verified safely."
            )

        else:
            reply = (
                "Of course. I will pass this "
                "conversation to a member of "
                "the salon team."
            )

    elif intent in {
        WhatsAppBotIntent.PRICE,
        WhatsAppBotIntent.SERVICES,
        WhatsAppBotIntent.OPENING_HOURS,
    }:
        next_action = (
            "answer_information"
        )

        requires_human = False

        if (
            intent
            == WhatsAppBotIntent.PRICE
        ):
            if entities.service_name:
                reply = (
                    "I can look up the current "
                    f"published price for "
                    f"{entities.service_name}."
                )
            else:
                reply = (
                    "Which service would you "
                    "like the price for?"
                )

        elif (
            intent
            == WhatsAppBotIntent.SERVICES
        ):
            reply = (
                "I can help you find a salon "
                "service. Tell me what you "
                "would like done with your hair."
            )

        else:
            reply = (
                "I can check the salon's "
                "published opening information."
            )

    elif (
        intent
        == WhatsAppBotIntent.GREETING
    ):
        next_action = "greet"

        requires_human = False

        reply = (
            "Hello. I am the SalonAI WhatsApp "
            "assistant. I can help with services, "
            "prices and appointment requests. "
            "What would you like to do?"
        )

    else:
        next_action = (
            "ask_clarification"
        )

        requires_human = False

        reply = (
            "I can help with appointments, "
            "services and prices. Could you "
            "tell me what you would like to do?"
        )

    return (
        WhatsAppBotAnalysisResponse(
            intent=intent,
            confidence=confidence,
            entities=entities,
            next_action=next_action,
            requires_human=
                requires_human,
            reply_suggestion=reply,
            provider_mode=
                provider_mode,
            model_name=
                "salonai-whatsapp-intent-rules-v1",
            rules_applied=
                rules,
        )
    )