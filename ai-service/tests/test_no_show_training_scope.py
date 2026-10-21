from datetime import datetime, timezone
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import types

import pytest


# The generic AI-service CI intentionally installs only the runtime/test
# dependencies. Keep these governance tests independent of optional ML
# packages; the dedicated AI training workflow exercises the real core.
core_stub = types.ModuleType("train_no_show_core")
core_stub.TASK = "appointment_no_show_48h"
core_stub.FEATURE_VERSION = "no-show-v1"
core_stub.MODEL_NAME = "salonai-no-show-risk-ml"
core_stub.load_dataset = lambda *_args, **_kwargs: (None, None)
core_stub.main = lambda: None
sys.modules["train_no_show_core"] = core_stub

import train_no_show as guarded_trainer


BUSINESS = "507f1f77bcf86cd799439011"
LOCATION = "507f1f77bcf86cd799439012"


class FakeUpdateResult:
    def __init__(self, matched_count=1):
        self.matched_count = matched_count


class FakeCollection:
    def __init__(self, *, document=None, counts=None):
        self.document = document
        self.counts = list(counts or [])
        self.queries = []
        self.updates = []

    def find_one(self, query):
        self.queries.append(query)
        return self.document

    def count_documents(self, query):
        self.queries.append(query)
        if not self.counts:
            return 0
        return self.counts.pop(0)

    def update_one(self, query, update):
        self.updates.append((query, update))
        return FakeUpdateResult()


class FakeDatabase:
    def __init__(self, dataset, snapshot_counts, model_version=None):
        self.collections = {
            "aitrainingdatasets": FakeCollection(document=dataset),
            "aifeaturesnapshots": FakeCollection(counts=snapshot_counts),
            "aimodelversions": FakeCollection(document=model_version),
        }

    def __getitem__(self, name):
        return self.collections[name]


class FakeClient:
    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True


def frozen_dataset(*, locations=None):
    return {
        "_id": "dataset-id",
        "name": "salonai-no-show",
        "version": "v1",
        "status": "frozen",
        "task": guarded_trainer.core.TASK,
        "featureVersion": guarded_trainer.core.FEATURE_VERSION,
        "schemaHash": "a" * 64,
        "dataHash": "b" * 64,
        "lineage": {
            "builderVersion": "no-show-v1-tenant-scoped-v1",
            "gitCommit": "abc123",
            "sourceCollections": ["appointments"],
        },
        "scope": {
            "mode": "single_business",
            "business": BUSINESS,
            "locations": list(locations or []),
            "deidentified": True,
        },
    }


def test_scope_guard_rejects_cross_business_snapshots(monkeypatch):
    database = FakeDatabase(frozen_dataset(), [1])
    called = False

    def unsafe_loader(*_args, **_kwargs):
        nonlocal called
        called = True
        raise AssertionError("core loader must not run after a scope violation")

    monkeypatch.setattr(guarded_trainer, "_ORIGINAL_LOAD_DATASET", unsafe_loader)

    with pytest.raises(RuntimeError, match="outside its trusted Business scope"):
        guarded_trainer.load_tenant_scoped_dataset(database, "v1")

    assert called is False
    snapshot_query = database["aifeaturesnapshots"].queries[0]
    assert snapshot_query["business"] == {"$ne": BUSINESS}


def test_scope_guard_rejects_rows_outside_governed_locations(monkeypatch):
    database = FakeDatabase(frozen_dataset(locations=[LOCATION]), [0, 1])

    monkeypatch.setattr(
        guarded_trainer,
        "_ORIGINAL_LOAD_DATASET",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AssertionError("core loader must not run after a location-scope violation")
        ),
    )

    with pytest.raises(RuntimeError, match="outside its governed Location scope"):
        guarded_trainer.load_tenant_scoped_dataset(database, "v1")

    location_query = database["aifeaturesnapshots"].queries[1]
    assert location_query["business"] == BUSINESS
    assert location_query["location"] == {"$nin": [LOCATION]}


def test_scope_guard_delegates_only_after_clean_preflight(monkeypatch):
    dataset = frozen_dataset(locations=[LOCATION])
    database = FakeDatabase(dataset, [0, 0])
    sentinel_frame = object()

    monkeypatch.setattr(
        guarded_trainer,
        "_ORIGINAL_LOAD_DATASET",
        lambda _database, version: (dataset, sentinel_frame)
        if version == "v1"
        else (_ for _ in ()).throw(AssertionError("unexpected version")),
    )

    loaded_dataset, frame = guarded_trainer.load_tenant_scoped_dataset(
        database,
        "v1",
    )

    assert loaded_dataset is dataset
    assert frame is sentinel_frame


def test_scope_guard_requires_explicit_single_business_deidentified_dataset():
    dataset = frozen_dataset()
    dataset["scope"]["mode"] = "platform_global"

    with pytest.raises(RuntimeError, match="single_business"):
        guarded_trainer._trusted_single_business_scope(dataset)

    dataset = frozen_dataset()
    dataset["scope"]["deidentified"] = False

    with pytest.raises(RuntimeError, match="deidentified"):
        guarded_trainer._trusted_single_business_scope(dataset)


def test_governed_manifest_is_written_and_attached_to_existing_model_registry(
    tmp_path: Path,
    monkeypatch,
):
    dataset = frozen_dataset(locations=[LOCATION])
    model_version = {
        "_id": "model-version-id",
        "name": guarded_trainer.core.MODEL_NAME,
        "version": "model-v1",
        "task": guarded_trainer.core.TASK,
        "featureVersion": guarded_trainer.core.FEATURE_VERSION,
        "lifecycle": "candidate",
        "trainingDataset": dataset["_id"],
        "algorithm": "logistic_regression",
        "thresholds": {"operational": 0.42},
        "createdAt": datetime(2026, 10, 19, 15, 0, tzinfo=timezone.utc),
    }
    database = FakeDatabase(dataset, [], model_version=model_version)
    client = FakeClient()

    monkeypatch.setattr(
        guarded_trainer.core,
        "mongo_database",
        lambda: (client, database),
        raising=False,
    )

    artifact_dir = tmp_path / "v1" / "model-v1"
    artifact_dir.mkdir(parents=True)
    (artifact_dir / "model.joblib").write_bytes(b"governed-model")

    args = SimpleNamespace(
        artifact_dir=str(tmp_path),
        dataset_version="v1",
        model_version="model-v1",
    )
    manifest_path = guarded_trainer._write_governed_manifest(args)

    assert client.closed is True
    assert manifest_path == artifact_dir / "model.manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["model"]["lifecycle"] == "candidate"
    assert manifest["dataset"]["scope"]["business"] == BUSINESS
    assert manifest["dataset"]["scope"]["locations"] == [LOCATION]
    assert len(manifest["artifact"]["sha256"]) == 64

    updates = database["aimodelversions"].updates
    assert len(updates) == 1
    query, update = updates[0]
    assert query["_id"] == model_version["_id"]
    assert query["lifecycle"] == {"$in": ["experiment", "candidate"]}
    governance = update["$set"]["metadata.governance"]
    assert governance["manifestSchemaVersion"] == "salonai.model-artifact.v1"
    assert governance["manifestUri"] == str(manifest_path)
    assert governance["dataset"]["dataHash"] == "b" * 64


def test_governed_manifest_refuses_registry_states_outside_training_lifecycle(
    tmp_path: Path,
    monkeypatch,
):
    dataset = frozen_dataset()
    database = FakeDatabase(dataset, [], model_version=None)
    client = FakeClient()

    monkeypatch.setattr(
        guarded_trainer.core,
        "mongo_database",
        lambda: (client, database),
        raising=False,
    )

    args = SimpleNamespace(
        artifact_dir=str(tmp_path),
        dataset_version="v1",
        model_version="model-v1",
    )

    with pytest.raises(RuntimeError, match="experiment/candidate registry entry"):
        guarded_trainer._write_governed_manifest(args)

    model_query = database["aimodelversions"].queries[0]
    assert model_query["lifecycle"] == {"$in": ["experiment", "candidate"]}
    assert client.closed is True
