from datetime import datetime, timezone

import pytest

from train_demand_ai_core import observation_from_snapshot


def snapshot(**overrides):
    payload = {
        "asOf": datetime(2026, 1, 5, tzinfo=timezone.utc),
        "label": 12,
        "features": {
            "available_staff_hours": 16.5,
            "appointment_capacity": 0,
            "workforce_capacity_observed": 1,
        },
    }
    payload.update(overrides)
    return payload


def test_snapshot_conversion_preserves_governed_capacity_observation():
    observation = observation_from_snapshot(snapshot())

    assert observation.business_date.isoformat() == "2026-01-05"
    assert observation.booked_appointments == 12
    assert observation.available_staff_hours == 16.5
    assert observation.appointment_capacity == 0
    assert observation.workforce_capacity_observed is True


def test_snapshot_conversion_distinguishes_missing_capacity_from_known_zero():
    observation = observation_from_snapshot(
        snapshot(
            features={
                "available_staff_hours": 0,
                "appointment_capacity": 0,
                "workforce_capacity_observed": 0,
            }
        )
    )

    assert observation.available_staff_hours == 0
    assert observation.workforce_capacity_observed is False


def test_snapshot_conversion_rejects_invalid_capacity_observed_flag():
    with pytest.raises(RuntimeError, match="exactly 0 or 1"):
        observation_from_snapshot(
            snapshot(
                features={
                    "available_staff_hours": 8,
                    "appointment_capacity": 0,
                    "workforce_capacity_observed": 2,
                }
            )
        )


def test_snapshot_conversion_rejects_negative_demand_label():
    with pytest.raises(RuntimeError, match="cannot be negative"):
        observation_from_snapshot(snapshot(label=-1))
