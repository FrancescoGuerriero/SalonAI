# Consultation booking experiment v1

Issue: #307

## Goal

Train the first interpretable consultation ML experiment without creating a production activation path.

The experiment predicts `bookingConverted` from the governed structured consultation-learning record and compares cross-validated results with the deterministic majority-class baseline from `consultation-baseline-evaluation-v1`.

## Required inputs

1. A verified `consultation-dataset-snapshot-v1` JSON snapshot.
2. Baseline evidence generated from that exact snapshot.
3. A separate `salonai.consultation-training-authorization.v1` JSON authorization that binds:
   - the exact dataset version and snapshot SHA-256;
   - the governed source kind;
   - a trusted single-Business, deidentified dataset scope;
   - dataset schema/data hashes and lineage;
   - an opaque authorization reference;
   - the explicitly permitted algorithm.

The snapshot itself continues to state `trainingAuthorised=false`. Training authority is deliberately separate so snapshot creation cannot self-authorize model training.

## Model

The first experiment uses:

- `DictVectorizer` over allowlisted structured consultation/rule features;
- scikit-learn `LogisticRegression`;
- balanced class weighting;
- deterministic random state `42`;
- stratified cross-validation, up to five folds;
- accuracy, balanced accuracy, precision, recall and F1 evidence.

At least two records from each outcome class are required. The trainer fits the final experiment only after cross-validation evidence is produced.

## Run

From `ai-service/` after installing `requirements.training.txt`:

```bash
python train_consultation_booking.py \
  path/to/snapshot.json \
  path/to/baseline.json \
  path/to/training-authorization.json \
  --model-version 2026-10-21.1 \
  --artifact-dir artifacts/consultation
```

Outputs are placed under `<artifact-dir>/<dataset-version>/<model-version>/`:

- `model.joblib`;
- `metrics.json`;
- `model.manifest.json` using the shared `salonai.model-artifact.v1` provenance/checksum contract.

## Hard boundary

This command:

- has no MongoDB/database access;
- cannot train from raw production collections;
- requires the exact previously evaluated snapshot;
- cannot emit `candidate` or `active` lifecycle state;
- performs no model-registry write;
- performs no production inference change;
- performs no Customer, Appointment, Business, Location or RBAC write.

A later reviewed increment may register or promote a successful experiment, but only after the tenant/runtime production prerequisites and explicit model-promotion evidence are satisfied.
