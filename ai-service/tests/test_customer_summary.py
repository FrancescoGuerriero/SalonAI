from app.schemas.customer_summary import CustomerSummaryRequest
from app.services.customer_summariser import build_customer_summary


def sample_payload() -> dict:
    return {
        "customer_id": "customer-123",
        "display_name": "Alex Morgan",
        "loyalty_tier": "gold",
        "metrics": {
            "visit_count": 8,
            "completed_appointments": 7,
            "cancelled_appointments": 1,
            "no_show_appointments": 0,
            "total_spent": 640,
            "average_spend": 80,
            "loyalty_points": 120,
        },
        "hair_profile": {
            "hair_type": "curly",
            "texture": "coarse",
            "concerns": ["dryness", "breakage"],
            "allergies": ["PPD"],
            "products_to_avoid": ["strong fragrance"],
            "current_hair_colour": "dark brown",
        },
        "booking_preferences": {
            "preferred_days": ["saturday"],
            "preferred_time_of_day": "morning",
            "preferred_reminder_channel": "sms",
        },
        "preferred_services": ["Cut and finish"],
        "preferred_stylist": "Taylor",
        "recent_appointments": [
            {
                "appointment_id": "a1",
                "status": "completed",
                "service_name": "Cut and finish",
                "final_price": 80,
                "amount_paid": 80,
            },
            {
                "appointment_id": "a2",
                "status": "completed",
                "service_name": "Cut and finish",
                "final_price": 80,
                "amount_paid": 80,
            },
        ],
        "recent_notes": [
            {
                "note_type": "follow_up",
                "title": "Check colour reaction",
                "content": "Call after patch test.",
                "requires_follow_up": True,
                "follow_up_completed": False,
            }
        ],
        "recent_orders": [
            {
                "order_number": "SA-1",
                "status": "completed",
                "total": 25,
                "products": ["Curl cream"],
            }
        ],
    }


def test_customer_summary_highlights_preferences_safety_and_actions():
    summary = build_customer_summary(CustomerSummaryRequest(**sample_payload()))

    assert summary.headline == "Customer briefing for Alex Morgan"
    assert any("Preferred stylist" in item for item in summary.key_preferences)
    assert any("allergy" in item.lower() for item in summary.hair_and_safety_notes)
    assert any("follow-up" in item.lower() for item in summary.relationship_actions)
    assert any("Curl cream" in item for item in summary.product_insights)
    assert summary.confidence >= 0.8


def test_customer_summary_identifies_data_gaps_and_rebooking():
    payload = CustomerSummaryRequest(
        customer_id="customer-456",
        display_name="Jamie Lee",
    )

    summary = build_customer_summary(payload)

    assert any("no upcoming appointment" in item.lower() for item in summary.relationship_actions)
    assert any("Hair type" in item for item in summary.data_quality_gaps)
    assert any("retail order" in item for item in summary.data_quality_gaps)


def test_customer_summary_endpoint_requires_service_key(client):
    response = client.post(
        "/api/v1/customer-summaries/generate",
        json=sample_payload(),
    )

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "INVALID_SERVICE_KEY"


def test_customer_summary_endpoint_returns_structured_response(client, auth_headers):
    response = client.post(
        "/api/v1/customer-summaries/generate",
        headers=auth_headers,
        json=sample_payload(),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["headline"] == "Customer briefing for Alex Morgan"
    assert body["metadata"]["model_name"] == "salonai-customer-summary-rules-v1"
    assert isinstance(body["relationship_actions"], list)
