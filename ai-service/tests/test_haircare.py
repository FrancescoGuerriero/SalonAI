def test_haircare_recommendation_is_explainable(client, auth_headers):
    response = client.post(
        "/api/v1/haircare/recommendations",
        headers=auth_headers,
        json={
            "customer_id": "customer-123",
            "hair_type": "curly",
            "texture": "coarse",
            "concerns": ["dryness", "damage", "colour_care"],
            "chemical_services": ["colour", "bleach"],
            "heat_styling_per_week": 4,
            "maintenance_preference": "medium",
            "scalp_sensitive": True,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["metadata"]["provider_mode"] == "mock"
    assert "moisture-support" in data["metadata"]["rules_applied"]
    assert "repair-support" in data["metadata"]["rules_applied"]
    assert any(item["name"] == "Moisture treatment" for item in data["recommended_services"])
    assert "Heat protectant" in data["product_categories"]
    assert data["cautions"]
    assert 0.68 <= data["confidence"] <= 0.96


def test_medical_concerns_return_referral_caution(client, auth_headers):
    response = client.post(
        "/api/v1/haircare/recommendations",
        headers=auth_headers,
        json={
            "hair_type": "straight",
            "concerns": ["thinning", "dandruff"],
        },
    )

    assert response.status_code == 200
    caution_text = " ".join(response.json()["cautions"]).lower()
    assert "gp" in caution_text
    assert "not a diagnosis" in caution_text


def test_invalid_hair_type_returns_structured_validation_error(client, auth_headers):
    response = client.post(
        "/api/v1/haircare/recommendations",
        headers=auth_headers,
        json={"hair_type": "unknown"},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
