import pytest

from app.core.config import Settings


PRODUCTION_SERVICE_KEY = (
    "production-ai-service-key-"
    "0123456789abcdef0123456789abcdef"
)


def build_settings(**overrides) -> Settings:
    values = {
        "environment": "development",
        "provider_mode": "mock",
        "service_key": PRODUCTION_SERVICE_KEY,
    }
    values.update(overrides)
    return Settings(
        _env_file=None,
        **values,
    )


def test_development_can_use_mock_provider_mode():
    settings = build_settings()

    assert settings.environment == "development"
    assert settings.provider_mode == "mock"


def test_production_requires_local_provider_mode():
    settings = build_settings(
        environment="production",
        provider_mode="local",
    )

    assert settings.environment == "production"
    assert settings.provider_mode == "local"


@pytest.mark.parametrize(
    "provider_mode",
    [
        "mock",
        "openai",
    ],
)
def test_production_rejects_non_local_provider_modes(
    provider_mode,
):
    with pytest.raises(
        ValueError,
        match="PROVIDER_MODE=local",
    ):
        build_settings(
            environment="production",
            provider_mode=provider_mode,
        )
