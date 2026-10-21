# Consultation baseline evaluation v1

Issue: #307

## Purpose

Provide a deterministic offline reference score for governed consultation learning snapshots before any consultation ML model is trained or considered for production use.

The first baseline task is **consultation booking conversion**. It predicts the majority observed `bookingConverted` class and records reproducible evidence that later ML experiments can compare against.

## Safety boundary

This evaluator:

- reads only a versioned consultation snapshot JSON file;
- verifies the `consultation-dataset-snapshot-v1` fingerprint and privacy contract;
- requires `trainingAuthorised=false`;
- accepts only `synthetic`, `test-fixture`, or `approved-governed-export` sources;
- requires `directProductionDatabaseAccess=false`;
- contains no MongoDB/database client;
- performs no model training;
- creates no model artifact;
- changes no production inference path;
- performs no Customer, Appointment, RBAC, Business or Location writes.

An `approved-governed-export` must retain its approval reference. Raw identifiers, transcripts and free-text notes are rejected by the snapshot privacy checks.

## Run

From `ai-service/`:

```bash
python evaluate_consultation_baseline.py path/to/snapshot.json \
  --output artifacts/consultation-baseline.json
```

The output uses `consultation-baseline-evaluation-v1` and records:

- dataset version and SHA-256 fingerprint;
- source kind and use policy;
- record/class counts;
- majority-class prediction;
- accuracy and, when both classes are represented, balanced accuracy;
- a deterministic SHA-256 fingerprint of the evaluation evidence;
- explicit flags proving that training, model-artifact creation and production activation did not occur.

## Interpretation

The majority-class result is intentionally simple. It is the minimum deterministic baseline that a later consultation-booking ML experiment should compare against. It is not a production model and does not establish that an ML candidate is safe, useful, fair or deployable.

A later training increment must introduce an explicit governed training-authorisation contract, preserve tenant/data provenance, evaluate an interpretable model against this baseline, and emit only an experiment/candidate artifact. Production promotion remains a separate decision.
