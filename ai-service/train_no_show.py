from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd
from pymongo import MongoClient
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.schemas.no_show_prediction import NoShowPredictionRequest
from app.services.no_show_predictor import predict_no_shows


TASK = "no_show_prediction"
FEATURE_VERSION = "no-show-v1"
MODEL_NAME = "salonai-no-show-risk-ml"


NUMERIC_FEATURES = [
    "previous_bookings",
    "previous_completed",
    "previous_no_shows",
    "previous_no_show_rate",
    "previous_cancellations",
    "previous_cancellation_rate",
    "days_since_last_completed",
    "booking_lead_time_days",
    "reschedules_before_prediction",
    "appointment_weekday",
    "appointment_hour",
    "duration_minutes",
    "appointment_value",
]

BOOLEAN_FEATURES = [
    "is_new_customer",
    "reminder_sent_before_prediction",
    "is_weekend",
    "is_evening",
]

CATEGORICAL_FEATURES = [
    "booking_source",
    "service_key",
    "stylist_key",
]

ALL_FEATURES = (
    NUMERIC_FEATURES
    + BOOLEAN_FEATURES
    + CATEGORICAL_FEATURES
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Train and evaluate SalonAI no-show baselines "
            "from a frozen AiFeatureSnapshot dataset."
        )
    )
    parser.add_argument(
        "--dataset-version",
        required=True,
    )
    parser.add_argument(
        "--model-version",
        required=True,
    )
    parser.add_argument(
        "--artifact-dir",
        default="artifacts/no-show",
    )
    return parser.parse_args()


def mongo_database():
    uri = (
        os.environ.get("MONGODB_URI")
        or os.environ.get("MONGO_URI")
        or ""
    ).strip()

    if not uri:
        raise RuntimeError(
            "MONGODB_URI is required."
        )

    client = MongoClient(uri)
    database = client.get_default_database()

    if database is None:
        raise RuntimeError(
            "MONGODB_URI must contain a database name."
        )

    return client, database


def load_dataset(database, dataset_version: str):
    dataset = database[
        "aitrainingdatasets"
    ].find_one(
        {
            "name": "salonai-no-show",
            "version": dataset_version,
            "status": "frozen",
            "task": TASK,
            "featureVersion": FEATURE_VERSION,
        }
    )

    if not dataset:
        raise RuntimeError(
            "Frozen no-show training dataset not found."
        )

    rows = list(
        database[
            "aifeaturesnapshots"
        ].find(
            {
                "task": TASK,
                "featureVersion": FEATURE_VERSION,
                "datasetVersion": dataset_version,
                "label": {"$in": [0, 1]},
                "split": {
                    "$in": [
                        "train",
                        "validation",
                        "test",
                    ]
                },
            },
            {
                "_id": 0,
                "features": 1,
                "label": 1,
                "split": 1,
                "asOf": 1,
            },
        ).sort("asOf", 1)
    )

    if len(rows) < 30:
        raise RuntimeError(
            "At least 30 frozen observations are required."
        )

    records = []

    for row in rows:
        features = dict(
            row.get("features") or {}
        )

        records.append(
            {
                **{
                    name: features.get(name)
                    for name in ALL_FEATURES
                },
                "label": int(row["label"]),
                "split": row["split"],
                "as_of": row.get("asOf"),
            }
        )

    frame = pd.DataFrame(records)

    for split in [
        "train",
        "validation",
        "test",
    ]:
        current = frame[
            frame["split"] == split
        ]

        if current.empty:
            raise RuntimeError(
                f"Dataset split '{split}' is empty."
            )

        if current["label"].nunique() < 2:
            raise RuntimeError(
                f"Dataset split '{split}' must contain both labels."
            )

    return dataset, frame


def preprocessor() -> ColumnTransformer:
    numeric = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="median"
                ),
            ),
            (
                "scale",
                StandardScaler(),
            ),
        ]
    )

    boolean = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="most_frequent"
                ),
            )
        ]
    )

    categorical = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="most_frequent"
                ),
            ),
            (
                "onehot",
                OneHotEncoder(
                    handle_unknown="ignore",
                    min_frequency=2,
                ),
            ),
        ]
    )

    return ColumnTransformer(
        transformers=[
            (
                "numeric",
                numeric,
                NUMERIC_FEATURES,
            ),
            (
                "boolean",
                boolean,
                BOOLEAN_FEATURES,
            ),
            (
                "categorical",
                categorical,
                CATEGORICAL_FEATURES,
            ),
        ]
    )


def pipeline(estimator) -> Pipeline:
    return Pipeline(
        steps=[
            (
                "features",
                preprocessor(),
            ),
            (
                "model",
                estimator,
            ),
        ]
    )


def probabilities(model, x):
    return model.predict_proba(x)[:, 1]


def choose_threshold(
    labels,
    probability,
) -> float:
    precision, recall, thresholds = (
        precision_recall_curve(
            labels,
            probability,
        )
    )

    if len(thresholds) == 0:
        return 0.5

    beta = 2.0
    scores = (
        (1 + beta**2)
        * precision[:-1]
        * recall[:-1]
        / (
            beta**2
            * precision[:-1]
            + recall[:-1]
            + 1e-12
        )
    )

    return float(
        thresholds[
            int(scores.argmax())
        ]
    )


def metrics(
    labels,
    probability,
    threshold,
) -> dict[str, float]:
    predicted = (
        probability >= threshold
    ).astype(int)

    return {
        "roc_auc": float(
            roc_auc_score(
                labels,
                probability,
            )
        ),
        "pr_auc": float(
            average_precision_score(
                labels,
                probability,
            )
        ),
        "brier_score": float(
            brier_score_loss(
                labels,
                probability,
            )
        ),
        "precision": float(
            precision_score(
                labels,
                predicted,
                zero_division=0,
            )
        ),
        "recall": float(
            recall_score(
                labels,
                predicted,
                zero_division=0,
            )
        ),
        "threshold": float(
            threshold
        ),
    }


def current_rules_probability(frame: pd.DataFrame):
    appointments = []

    for index, row in frame.reset_index(drop=True).iterrows():
        as_of = pd.Timestamp(
            row["as_of"]
        )
        appointment_date = (
            as_of
            + pd.Timedelta(
                hours=48
            )
        )

        appointments.append(
            {
                "appointment_key": f"evaluation-{index}",
                "customer_key": f"evaluation-customer-{index}",
                "appointment_date": appointment_date.to_pydatetime(),
                "service_name": str(
                    row.get(
                        "service_key"
                    )
                    or ""
                ),
                "appointment_value": float(
                    row.get(
                        "appointment_value"
                    )
                    or 0
                ),
                "lead_time_days": float(
                    row.get(
                        "booking_lead_time_days"
                    )
                    or 0
                ),
                "previous_bookings": int(
                    row.get(
                        "previous_bookings"
                    )
                    or 0
                ),
                "previous_completed": int(
                    row.get(
                        "previous_completed"
                    )
                    or 0
                ),
                "previous_no_shows": int(
                    row.get(
                        "previous_no_shows"
                    )
                    or 0
                ),
                "previous_cancellations": int(
                    row.get(
                        "previous_cancellations"
                    )
                    or 0
                ),
                "days_since_last_visit": (
                    None
                    if pd.isna(
                        row.get(
                            "days_since_last_completed"
                        )
                    )
                    else max(
                        0,
                        int(
                            row.get(
                                "days_since_last_completed"
                            )
                        ),
                    )
                ),
                "reschedule_count": int(
                    row.get(
                        "reschedules_before_prediction"
                    )
                    or 0
                ),
                "reminder_status": (
                    "sent"
                    if bool(
                        row.get(
                            "reminder_sent_before_prediction"
                        )
                    )
                    else "none"
                ),
                "deposit_status": "none",
                "is_new_customer": bool(
                    row.get(
                        "is_new_customer"
                    )
                ),
                "is_weekend": bool(
                    row.get(
                        "is_weekend"
                    )
                ),
                "is_evening": bool(
                    row.get(
                        "is_evening"
                    )
                ),
            }
        )

    payload = NoShowPredictionRequest(
        as_of_date=pd.Timestamp(
            frame["as_of"].max()
        ).date(),
        appointments=appointments,
    )

    result = predict_no_shows(
        payload,
        provider_mode="evaluation",
    )

    probabilities_by_key = {
        prediction.appointment_key:
            prediction.probability
        for prediction in result.predictions
    }

    return pd.Series(
        [
            probabilities_by_key[
                f"evaluation-{index}"
            ]
            for index in range(
                len(frame)
            )
        ],
        dtype=float,
    ).to_numpy()


def train_candidates(
    train_x,
    train_y,
):
    return {
        "prior_dummy": pipeline(
            DummyClassifier(
                strategy="prior"
            )
        ).fit(
            train_x,
            train_y,
        ),
        "logistic_regression": pipeline(
            LogisticRegression(
                max_iter=2000,
                class_weight="balanced",
                random_state=42,
            )
        ).fit(
            train_x,
            train_y,
        ),
        "random_forest": pipeline(
            RandomForestClassifier(
                n_estimators=400,
                max_depth=8,
                min_samples_leaf=3,
                class_weight="balanced",
                random_state=42,
                n_jobs=-1,
            )
        ).fit(
            train_x,
            train_y,
        ),
    }


def main() -> None:
    args = parse_args()
    client, database = mongo_database()

    try:
        dataset, frame = load_dataset(
            database,
            args.dataset_version,
        )

        train = frame[
            frame["split"] == "train"
        ]
        validation = frame[
            frame["split"] == "validation"
        ]
        test = frame[
            frame["split"] == "test"
        ]

        models = train_candidates(
            train[ALL_FEATURES],
            train["label"],
        )

        rules_validation_probability = (
            current_rules_probability(
                validation
            )
        )
        rules_threshold = 0.35
        rules_validation_metrics = metrics(
            validation["label"],
            rules_validation_probability,
            rules_threshold,
        )

        validation_results = {}

        for name, model in models.items():
            probability = probabilities(
                model,
                validation[ALL_FEATURES],
            )
            threshold = choose_threshold(
                validation["label"],
                probability,
            )
            validation_results[name] = metrics(
                validation["label"],
                probability,
                threshold,
            )

        eligible = [
            name
            for name in models
            if name != "prior_dummy"
        ]

        winner_name = max(
            eligible,
            key=lambda name:
                validation_results[name][
                    "pr_auc"
                ],
        )
        winner = models[winner_name]
        threshold = validation_results[
            winner_name
        ]["threshold"]

        test_probability = probabilities(
            winner,
            test[ALL_FEATURES],
        )
        test_metrics = metrics(
            test["label"],
            test_probability,
            threshold,
        )

        dummy_probability = probabilities(
            models["prior_dummy"],
            test[ALL_FEATURES],
        )
        dummy_test_metrics = metrics(
            test["label"],
            dummy_probability,
            0.5,
        )

        rules_test_probability = (
            current_rules_probability(
                test
            )
        )
        rules_test_metrics = metrics(
            test["label"],
            rules_test_probability,
            rules_threshold,
        )

        beats_rules_baseline = (
            test_metrics["pr_auc"]
            > rules_test_metrics["pr_auc"]
            and test_metrics["brier_score"]
            <= rules_test_metrics["brier_score"]
        )
        lifecycle = (
            "candidate"
            if beats_rules_baseline
            else "experiment"
        )

        artifact_dir = (
            Path(args.artifact_dir)
            / args.dataset_version
            / args.model_version
        )
        artifact_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        artifact_path = (
            artifact_dir
            / "model.joblib"
        )

        metadata = {
            "name": MODEL_NAME,
            "version": args.model_version,
            "task": TASK,
            "feature_version": FEATURE_VERSION,
            "dataset_version": args.dataset_version,
            "algorithm": winner_name,
            "selected_threshold": threshold,
            "validation": validation_results,
            "test": test_metrics,
            "dummy_test": dummy_test_metrics,
            "rules_validation": rules_validation_metrics,
            "rules_test": rules_test_metrics,
            "rules_model": "salonai-no-show-risk-rules-v1",
            "feature_names": ALL_FEATURES,
            "beats_rules_baseline": beats_rules_baseline,
            "lifecycle": lifecycle,
            "trained_at": datetime.now(
                timezone.utc
            ).isoformat(),
        }

        joblib.dump(
            {
                "model": winner,
                "metadata": metadata,
            },
            artifact_path,
        )

        (
            artifact_dir
            / "metrics.json"
        ).write_text(
            json.dumps(
                metadata,
                indent=2,
                sort_keys=True,
            ),
            encoding="utf-8",
        )

        dataset_id = dataset["_id"]

        database[
            "aimodelversions"
        ].replace_one(
            {
                "name": MODEL_NAME,
                "version": args.model_version,
            },
            {
                "name": MODEL_NAME,
                "version": args.model_version,
                "task": TASK,
                "modelType": "classification",
                "lifecycle": lifecycle,
                "trainingDataset": dataset_id,
                "featureVersion": FEATURE_VERSION,
                "algorithm": winner_name,
                "artifactUri": str(
                    artifact_path
                ),
                "metrics": {
                    "validation": validation_results,
                    "test": test_metrics,
                    "baseline": {
                        "dummy_test": dummy_test_metrics,
                        "rules_validation": rules_validation_metrics,
                        "rules_test": rules_test_metrics,
                        "rules_model": "salonai-no-show-risk-rules-v1",
                    },
                },
                "thresholds": {
                    "operational": threshold,
                },
                "limitations": [
                    "Experiment/candidate only; not approved for production inference.",
                    "Training data excludes appointments booked less than 48 hours before start.",
                    "Payment state is excluded until timestamped payment history is available.",
                    "Cancelled appointments are excluded from the binary training label.",
                ],
                "createdAt": datetime.now(
                    timezone.utc
                ),
                "updatedAt": datetime.now(
                    timezone.utc
                ),
            },
            upsert=True,
        )

        print(
            json.dumps(
                {
                    "status": lifecycle,
                    "beatsRulesBaseline": beats_rules_baseline,
                    "model": MODEL_NAME,
                    "version": args.model_version,
                    "datasetVersion": args.dataset_version,
                    "algorithm": winner_name,
                    "artifact": str(
                        artifact_path
                    ),
                    "validation": validation_results[
                        winner_name
                    ],
                    "test": test_metrics,
                    "dummyTest": dummy_test_metrics,
                    "rulesValidation": rules_validation_metrics,
                    "rulesTest": rules_test_metrics,
                    "rulesModel": "salonai-no-show-risk-rules-v1",
                },
                indent=2,
                sort_keys=True,
            )
        )

    finally:
        client.close()


if __name__ == "__main__":
    main()
