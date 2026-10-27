from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.governance.training_manifest_policy import evaluate_training_manifest
from app.schemas.ai_core import TrainingDatasetManifest
from app.training.demand_forecasting import (
    DemandObservation,
    DemandTrainingError,
    forecast_metrics,
    seasonal_naive_predictions,
    temporal_split,
)


def observations(days: int = 70) -> list[DemandObservation]:
    start = date(2026, 1, 1)
    weekday_pattern = [8, 10, 11, 12, 14, 16, 6]
    return [
        DemandObservation(
            business_date=start + timedelta(days=index),
            booked_appointments=float(weekday_pattern[index % 7]),
            available_staff_hours=32.0,
            appointment_capacity=20.0,
        )
        for index in range(days)
    ]


def test_temporal_split_is_chronological_and_non_overlapping():
    train, validation, test = temporal_split(observations())

    assert train[-1].business_date < validation[0].business_date
    assert validation[-1].business_date < test[0].business_date
    assert len(train) + len(validation) + len(test) == 70


def test_weekly_seasonal_naive_reproduces_weekday_pattern():
    rows = observations(49)
    prediction = seasonal_naive_predictions(rows[:42], rows[42:])

    assert prediction == [item.booked_appointments for item in rows[42:]]


def test_forecast_metrics_match_ai_core_contract():
    metrics = forecast_metrics([10, 20, 30], [12, 18, 27])

    assert metrics.mae == pytest.approx(7 / 3)
    assert metrics.wape == pytest.approx(7 / 60)
    assert metrics.rmse == pytest.approx((17 / 3) ** 0.5)
    assert metrics.forecast_bias == pytest.approx(-1.0)


def test_demand_training_rejects_too_little_history():
    with pytest.raises(DemandTrainingError, match="At least 42"):
        temporal_split(observations(28))


def test_ai_core_manifest_accepts_appointments_history_for_demand_forecasting_only_offline():
    manifest = TrainingDatasetManifest(
        dataset_key="appointments-history",
        business_id="business-1",
        location_id="location-1",
        approved_purpose="demand_forecasting",
        feature_definition_version="demand-daily-v1",
        row_count=84,
        sha256_fingerprint="a" * 64,
        generated_at="2026-10-27T20:00:00Z",
        provenance_source_ids=["canonical-appointments"],
        contains_direct_identifiers=False,
        contains_credentials=False,
    )

    decision = evaluate_training_manifest(manifest, track_key="demand-forecasting")

    assert decision.accepted is True
    assert decision.offline_training_only is True
    assert decision.production_promotion_authorised is False


def test_ai_core_manifest_rejects_unapproved_dataset_for_demand_track():
    manifest = TrainingDatasetManifest(
        dataset_key="commerce-history",
        business_id="business-1",
        location_id="location-1",
        approved_purpose="demand_forecasting",
        feature_definition_version="demand-daily-v1",
        row_count=84,
        sha256_fingerprint="b" * 64,
        generated_at="2026-10-27T20:00:00Z",
        provenance_source_ids=["canonical-commerce"],
        contains_direct_identifiers=False,
        contains_credentials=False,
    )

    with pytest.raises(ValueError):
        evaluate_training_manifest(manifest, track_key="demand-forecasting")
