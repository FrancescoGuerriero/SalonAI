VALID_PAYLOAD = {
    "hair_type": "wavy",
    "texture": "medium",
    "concerns": ["dryness"],
}


def test_recommendation_requires_service_key(client):
    response = client.post("/api/v1/haircare/recommendations", json=VALID_PAYLOAD)

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "INVALID_SERVICE_KEY"


def test_recommendation_rejects_wrong_service_key(client):
    response = client.post(
        "/api/v1/haircare/recommendations",
        json=VALID_PAYLOAD,
        headers={"X-SalonAI-Service-Key": "incorrect-key"},
    )

    assert response.status_code == 401
