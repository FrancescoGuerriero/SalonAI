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
            "feature_names": ALL_FEATURES,
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
                "lifecycle": "candidate",
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
                    },
                },
                "thresholds": {
                    "operational": threshold,
                },
                "limitations": [
                    "Candidate model only; not approved for production inference.",
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
                    "status": "candidate",
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
                },
                indent=2,
                sort_keys=True,
            )
        )

    finally:
        client.close()


if __name__ == "__main__":
    main()
