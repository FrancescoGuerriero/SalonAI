def test_health_is_public(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.headers["X-Request-ID"]


def test_ready_exposes_safe_runtime_state(client):
    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "providerMode": "mock",
        "security": "service-key",
    }
