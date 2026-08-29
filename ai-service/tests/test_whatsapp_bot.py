def test_whatsapp_bot_requires_service_key(
    client,
):
    response = client.post(
        "/api/v1/whatsapp-bot/analyse",
        json={
            "message":
                "I would like to book a haircut",
        },
    )

    assert response.status_code in {
        401,
        403,
    }


def test_whatsapp_bot_extracts_booking_details(
    client,
    auth_headers,
):
    response = client.post(
        "/api/v1/whatsapp-bot/analyse",
        headers=auth_headers,
        json={
            "message": (
                "Hi, I want to book Blow-dry "
                "with Francesco P tomorrow at 3pm"
            ),
            "services": [
                "Blow-dry",
                "Child Cuts",
            ],
            "stylists": [
                "Francesco P",
            ],
        },
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["intent"] == "booking"
    assert payload["confidence"] >= 0.9

    assert (
        payload["entities"]["service_name"]
        == "Blow-dry"
    )

    assert (
        payload["entities"]["stylist_name"]
        == "Francesco P"
    )

    assert (
        payload["entities"]["date_text"]
        == "tomorrow"
    )

    assert (
        payload["entities"]["time_text"]
        == "3pm"
    )

    assert (
        payload["next_action"]
        == "check_availability"
    )

    assert payload["requires_human"] is False


def test_whatsapp_bot_supports_any_stylist(
    client,
    auth_headers,
):
    response = client.post(
        "/api/v1/whatsapp-bot/analyse",
        headers=auth_headers,
        json={
            "message": (
                "Can I book Blow-dry tomorrow "
                "morning with any stylist?"
            ),
            "services": [
                "Blow-dry",
            ],
        },
    )

    assert response.status_code == 200

    payload = response.json()

    assert (
        payload["entities"]["stylist_name"]
        == "Any available stylist"
    )

    assert (
        payload["entities"]["time_text"]
        == "morning"
    )

    assert (
        payload["next_action"]
        == "check_availability"
    )


def test_whatsapp_bot_extracts_named_date(
    client,
    auth_headers,
):
    response = client.post(
        "/api/v1/whatsapp-bot/analyse",
        headers=auth_headers,
        json={
            "message": (
                "I'd like the Blow-dry "
                "on 1 September"
            ),
            "current_stage": "date",
            "services": [
                "Blow-dry",
            ],
        },
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["intent"] == "booking"
    assert payload["confidence"] >= 0.9

    assert (
        payload["entities"]["service_name"]
        == "Blow-dry"
    )

    assert (
        payload["entities"]["date_text"]
        == "1 September"
    )

    assert (
        payload["next_action"]
        == "collect_time"
    )

    assert (
        "booking-stage-context"
        in payload["rules_applied"]
    )


def test_whatsapp_bot_uses_date_stage_context(
    client,
    auth_headers,
):
    response = client.post(
        "/api/v1/whatsapp-bot/analyse",
        headers=auth_headers,
        json={
            "message": "1 September",
            "current_stage": "date",
            "services": [
                "Blow-dry",
            ],
        },
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["intent"] == "booking"
    assert payload["confidence"] >= 0.9

    assert (
        payload["entities"]["date_text"]
        == "1 September"
    )

    assert (
        payload["next_action"]
        == "collect_time"
    )

    assert (
        "booking-stage-context"
        in payload["rules_applied"]
    )


def test_whatsapp_bot_uses_time_stage_context(
    client,
    auth_headers,
):
    response = client.post(
        "/api/v1/whatsapp-bot/analyse",
        headers=auth_headers,
        json={
            "message": "3pm",
            "current_stage": "time",
            "services": [
                "Blow-dry",
            ],
        },
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["intent"] == "booking"
    assert payload["confidence"] >= 0.9

    assert (
        payload["entities"]["time_text"]
        == "3pm"
    )

    assert (
        payload["next_action"]
        == "check_availability"
    )

    assert (
        "booking-stage-context"
        in payload["rules_applied"]
    )


def test_cancellation_requires_human_handoff(
    client,
    auth_headers,
):
    response = client.post(
        "/api/v1/whatsapp-bot/analyse",
        headers=auth_headers,
        json={
            "message":
                "I need to cancel my appointment",
        },
    )

    assert response.status_code == 200

    payload = response.json()

    assert (
        payload["intent"]
        == "cancellation"
    )

    assert (
        payload["next_action"]
        == "handoff"
    )

    assert payload["requires_human"] is True


def test_unknown_message_requests_clarification(
    client,
    auth_headers,
):
    response = client.post(
        "/api/v1/whatsapp-bot/analyse",
        headers=auth_headers,
        json={
            "message":
                "Something completely unrelated",
        },
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["intent"] == "unknown"

    assert (
        payload["next_action"]
        == "ask_clarification"
    )