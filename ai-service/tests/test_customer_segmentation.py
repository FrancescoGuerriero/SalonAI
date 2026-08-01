from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.schemas.customer_segmentation import (
    CustomerSegmentFeatures,
    CustomerSegmentationRequest,
)
from app.services.customer_segmenter import analyse_customer_segments


client = TestClient(app)
settings = get_settings()
headers = {"X-SalonAI-Service-Key": settings.service_key}


def feature(**overrides):
    defaults = {
        "customer_ref": "customer-1",
        "account_age_days": 400,
        "completed_appointments": 8,
        "cancelled_appointments": 0,
        "no_show_appointments": 0,
        "upcoming_appointments": 1,
        "days_since_last_visit": 35,
        "days_until_next_appointment": 20,
        "service_spend": 900,
        "retail_spend": 120,
        "average_service_spend": 112.5,
        "discount_total": 20,
        "discount_usage_rate": 0.1,
        "rebooking_rate": 0.75,
        "marketing_engagement_rate": 0.5,
        "contact_attempts": 4,
        "product_orders": 2,
        "loyalty_points": 300,
        "has_marketing_consent": True,
        "preferred_channel": "email",
    }
    defaults.update(overrides)
    return CustomerSegmentFeatures(**defaults)


def test_loyal_high_value_customer_receives_multiple_segments():
    result = analyse_customer_segments(
        CustomerSegmentationRequest(customers=[feature()])
    ).customers[0]

    assert result.primary_segment == "loyal"
    assert "loyal" in result.segments
    assert "high_value" in result.segments
    assert result.value_score > 0.7
    assert result.risk_score < 0.4


def test_inactive_customer_is_prioritised_over_high_value():
    result = analyse_customer_segments(
        CustomerSegmentationRequest(
            customers=[
                feature(
                    upcoming_appointments=0,
                    days_since_last_visit=240,
                )
            ]
        )
    ).customers[0]

    assert result.primary_segment == "inactive"
    assert "inactive" in result.segments
    assert "high_value" in result.segments


def test_discount_sensitive_customer_is_detected():
    result = analyse_customer_segments(
        CustomerSegmentationRequest(
            customers=[
                feature(
                    completed_appointments=4,
                    service_spend=300,
                    retail_spend=0,
                    rebooking_rate=0.3,
                    discount_usage_rate=0.75,
                    upcoming_appointments=1,
                )
            ]
        )
    ).customers[0]

    assert "discount_sensitive" in result.segments


def test_endpoint_requires_service_key():
    response = client.post(
        "/api/v1/customer-segmentation/analyse",
        json={"customers": [feature().model_dump()]},
    )

    assert response.status_code in {401, 403}


def test_endpoint_returns_privacy_preserving_refs():
    response = client.post(
        "/api/v1/customer-segmentation/analyse",
        headers=headers,
        json={"customers": [feature().model_dump()]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["customers"][0]["customer_ref"] == "customer-1"
    assert "email" not in payload["customers"][0]
    assert "phone" not in payload["customers"][0]
