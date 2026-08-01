import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


TEST_SERVICE_KEY = "test-service-key-with-at-least-thirty-two-characters"


@pytest.fixture()
def client() -> TestClient:
    settings = Settings(
        environment="test",
        service_key=TEST_SERVICE_KEY,
        provider_mode="mock",
    )
    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture()
def auth_headers() -> dict[str, str]:
    return {"X-SalonAI-Service-Key": TEST_SERVICE_KEY}
