from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from math import sqrt
from typing import Iterable, Sequence


TRACK_KEY = "demand-forecasting"
DATASET_KEY = "appointments-history"
APPROVED_PURPOSE = "demand_forecasting"
SEASON_LENGTH_DAYS = 7
MINIMUM_OBSERVATIONS = 42


class DemandTrainingError(ValueError):
    """Raised when a demand-training experiment violates the offline contract."""


@dataclass(frozen=True)
class DemandObservation:
    business_date: date
    booked_appointments: float
    available_staff_hours: float = 0.0
    appointment_capacity: float = 0.0


@dataclass(frozen=True)
class ForecastMetrics:
    mae: float
    wape: float
    rmse: float
    forecast_bias: float


@dataclass(frozen=True)
class DemandCandidateResult:
    algorithm: str
    validation: ForecastMetrics
    test: ForecastMetrics
    baseline_validation: ForecastMetrics
    baseline_test: ForecastMetrics
    beats_seasonal_baseline: bool
    training_authorised: bool = False
    production_promotion_authorised: bool = False


def _ordered(observations: Iterable[DemandObservation]) -> list[DemandObservation]:
    rows = sorted(observations, key=lambda item: item.business_date)
    if len(rows) < MINIMUM_OBSERVATIONS:
        raise DemandTrainingError(
            f"At least {MINIMUM_OBSERVATIONS} daily observations are required."
        )

    dates = [item.business_date for item in rows]
    if len(dates) != len(set(dates)):
        raise DemandTrainingError("Demand observations must contain unique business dates.")

    if any(item.booked_appointments < 0 for item in rows):
        raise DemandTrainingError("Booked appointment counts cannot be negative.")

    return rows


def temporal_split(
    observations: Iterable[DemandObservation],
) -> tuple[list[DemandObservation], list[DemandObservation], list[DemandObservation]]:
    """Create leakage-resistant 70/15/15 chronological splits."""

    rows = _ordered(observations)
    train_end = max(SEASON_LENGTH_DAYS * 3, int(len(rows) * 0.70))
    validation_end = max(train_end + SEASON_LENGTH_DAYS, int(len(rows) * 0.85))

    if validation_end >= len(rows):
        validation_end = len(rows) - 1

    train = rows[:train_end]
    validation = rows[train_end:validation_end]
    test = rows[validation_end:]

    if not train or not validation or not test:
        raise DemandTrainingError("Temporal train/validation/test splits must all be non-empty.")

    return train, validation, test


def seasonal_naive_predictions(
    history: Sequence[DemandObservation],
    target: Sequence[DemandObservation],
    *,
    season_length: int = SEASON_LENGTH_DAYS,
) -> list[float]:
    """Forecast each target day from the observation one weekly season earlier.

    The target sequence is walked chronologically. Actual target observations become
    history only after their forecast is produced, mirroring genuine rolling evaluation.
    """

    if season_length < 1:
        raise DemandTrainingError("season_length must be positive.")

    values = [float(item.booked_appointments) for item in history]
    if len(values) < season_length:
        raise DemandTrainingError("Seasonal-naive evaluation requires a full history season.")

    predictions: list[float] = []
    for item in target:
        predictions.append(max(0.0, values[-season_length]))
        values.append(float(item.booked_appointments))

    return predictions


def forecast_metrics(actual: Sequence[float], predicted: Sequence[float]) -> ForecastMetrics:
    if len(actual) != len(predicted) or not actual:
        raise DemandTrainingError("Forecast metrics require equally sized non-empty series.")

    errors = [float(p) - float(a) for a, p in zip(actual, predicted)]
    absolute = [abs(value) for value in errors]
    squared = [value * value for value in errors]
    denominator = sum(abs(float(value)) for value in actual)

    return ForecastMetrics(
        mae=sum(absolute) / len(absolute),
        wape=(sum(absolute) / denominator) if denominator > 0 else 0.0,
        rmse=sqrt(sum(squared) / len(squared)),
        forecast_bias=sum(errors) / len(errors),
    )


def _feature_rows(rows: Sequence[DemandObservation]) -> tuple[list[list[float]], list[float]]:
    """Create pre-outcome calendar/lag/capacity features for offline experiments."""

    if len(rows) <= 28:
        raise DemandTrainingError("At least 29 observations are required to construct lag features.")

    x: list[list[float]] = []
    y: list[float] = []
    bookings = [float(item.booked_appointments) for item in rows]

    for index in range(28, len(rows)):
        item = rows[index]
        trailing_7 = bookings[index - 7:index]
        trailing_28 = bookings[index - 28:index]
        x.append(
            [
                float(item.business_date.weekday()),
                float(bookings[index - 7]),
                float(bookings[index - 14]),
                sum(trailing_7) / 7.0,
                sum(trailing_28) / 28.0,
                float(item.available_staff_hours),
                float(item.appointment_capacity),
            ]
        )
        y.append(bookings[index])

    return x, y


def run_offline_candidate(
    observations: Iterable[DemandObservation],
    *,
    random_state: int = 42,
) -> DemandCandidateResult:
    """Train/evaluate an offline demand candidate without authorising production use.

    scikit-learn is imported locally so the production FastAPI runtime does not acquire
    an ML dependency. This function is intended for requirements.training.txt only.
    """

    try:
        from sklearn.ensemble import HistGradientBoostingRegressor
    except ImportError as exc:  # pragma: no cover - depends on offline training env
        raise DemandTrainingError(
            "Offline demand training requires requirements.training.txt."
        ) from exc

    train, validation, test = temporal_split(observations)

    baseline_validation_values = seasonal_naive_predictions(train, validation)
    baseline_test_values = seasonal_naive_predictions(train + validation, test)
    baseline_validation = forecast_metrics(
        [item.booked_appointments for item in validation], baseline_validation_values
    )
    baseline_test = forecast_metrics(
        [item.booked_appointments for item in test], baseline_test_values
    )

    training_rows = train
    validation_context = train + validation
    test_context = train + validation + test

    train_x, train_y = _feature_rows(training_rows)
    validation_x_all, validation_y_all = _feature_rows(validation_context)
    test_x_all, test_y_all = _feature_rows(test_context)

    validation_x = validation_x_all[-len(validation):]
    validation_y = validation_y_all[-len(validation):]
    test_x = test_x_all[-len(test):]
    test_y = test_y_all[-len(test):]

    model = HistGradientBoostingRegressor(
        loss="squared_error",
        max_depth=4,
        learning_rate=0.05,
        max_iter=250,
        l2_regularization=0.1,
        random_state=random_state,
    )
    model.fit(train_x, train_y)

    validation_predicted = [max(0.0, float(value)) for value in model.predict(validation_x)]
    test_predicted = [max(0.0, float(value)) for value in model.predict(test_x)]

    validation_metrics = forecast_metrics(validation_y, validation_predicted)
    test_metrics = forecast_metrics(test_y, test_predicted)

    beats_baseline = (
        test_metrics.mae < baseline_test.mae
        and test_metrics.wape < baseline_test.wape
        and abs(test_metrics.forecast_bias) <= abs(baseline_test.forecast_bias)
    )

    return DemandCandidateResult(
        algorithm="hist_gradient_boosting",
        validation=validation_metrics,
        test=test_metrics,
        baseline_validation=baseline_validation,
        baseline_test=baseline_test,
        beats_seasonal_baseline=beats_baseline,
        training_authorised=False,
        production_promotion_authorised=False,
    )
