import pytest

import train_no_show as guarded_trainer


BUSINESS = "507f1f77bcf86cd799439011"
OTHER_BUSINESS = "507f191e810c19729de860ea"
LOCATION = "507f1f77bcf86cd799439012"


class FakeCollection:
    def __init__(self, *, document=None, counts=None):
        self.document = document
        self.counts = list(counts or [])
        self.queries = []

    def find_one(self, query):
        self.queries.append(query)
        return self.document

    def count_documents(self, query):
        self.queries.append(query)
        if not self.counts:
            return 0
        return self.counts.pop(0)


class FakeDatabase:
    def __init__(self, dataset, snapshot_counts):
        self.collections = {
            "aitrainingdatasets": FakeCollection(document=dataset),
            "aifeaturesnapshots": FakeCollection(counts=snapshot_counts),
        }

    def __getitem__(self, name):
        return self.collections[name]


def frozen_dataset(*, locations=None):
    return {
        "_id": "dataset-id",
        "name": "salonai-no-show",
        "version": "v1",
        "status": "frozen",
        "task": guarded_trainer.core.TASK,
        "featureVersion": guarded_trainer.core.FEATURE_VERSION,
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
