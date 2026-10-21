# No-show ML experiment v1

This is SalonAI's first governed supervised-learning experiment.

The existing `salonai-no-show-risk-rules-v1` predictor remains the operational baseline. Nothing in this experiment replaces production inference automatically.

## Prediction question

At **48 hours before the current appointment start**, estimate the probability that an eligible appointment will ultimately be recorded as a no-show.

The v1 binary label policy is:

- `no_show = 1`
- `completed = 0`
- cancelled appointments are excluded from the training label
- unresolved appointments are excluded
- appointments created less than 48 hours before start are excluded
- appointments rescheduled after the 48-hour snapshot are excluded because their final service/stylist/time would contain future information

## Leakage policy

Features must contain only state that can be reconstructed at the snapshot timestamp.

v1 deliberately excludes payment/deposit state because Appointment currently stores the current financial state but does not provide a complete timestamped payment-state history suitable for historical reconstruction.

v1 also excludes the current appointment status.

Historical customer outcomes are counted only when their terminal outcome was already observed by the target appointment's snapshot timestamp.

## Materialise a tenant-scoped dataset

Configure a dedicated pseudonym key. Do not reuse JWT/OAuth secrets. A trusted Business ObjectId is mandatory; global/unscoped dataset builds are not permitted by this entry point. An optional Location ObjectId may narrow the dataset further and is verified as belonging to the Business.

PowerShell example:

```powershell
$env:AI_DATASET_PSEUDONYM_KEY = "<dedicated-random-secret-at-least-32-characters>"

cd backend

# Read-only preview. No AI dataset rows are changed.
npm run ai:dataset:no-show -- --dataset-version=v1 --business-id=<trusted-business-object-id>

# Optional single-location preview.
npm run ai:dataset:no-show -- --dataset-version=v1 --business-id=<trusted-business-object-id> --location-id=<trusted-location-object-id>

# Freeze only after the dry-run summary has been reviewed.
npm run ai:dataset:no-show -- --dataset-version=v1 --business-id=<trusted-business-object-id> --apply --confirm=build-no-show-training-dataset
```

The dry-run summary includes Business/Location scope, deterministic schema/data hashes, temporal split evidence and a freeze-readiness report with total label distribution and completed/no-show counts for each train/validation/test split.

The apply command refuses to freeze a dataset when:

- the Business is missing or invalid;
- a requested Location is not owned by that Business;
- the dataset name/version conflicts with a differently scoped historical dataset;
- there are fewer than 30 eligible resolved observations;
- train, validation or test is empty;
- any temporal split contains only completed labels or only no-show labels.

These checks mirror the minimum structural requirements of the Python training pipeline, so SalonAI does not knowingly freeze a dataset that the trainer will immediately reject.

A dataset below 100 observations is explicitly marked with a small-dataset warning. Severe overall class imbalance is also reported as a warning for evaluation review rather than silently treated as reliable evidence.

The frozen data is stored in `AiFeatureSnapshot` and registered in `AiTrainingDataset`. The registry retains trusted single-Business scope, optional Location scope, schema/data hashes, source-collection lineage, builder version, split label distribution and readiness evidence.

## Training environment

Training dependencies are intentionally separate from the production FastAPI runtime.

From `ai-service`:

```powershell
python -m venv .venv-training
.\.venv-training\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.training.txt
```

The training environment currently pins:

- scikit-learn 1.9.1
- pandas 3.0.6
- PyMongo 4.18.1
- joblib 1.6.0

The runtime requirements are also installed so evaluation can call the exact current SalonAI rules implementation.

## Train and evaluate

Training reads only a previously frozen governed dataset. The wrapper verifies that every selected feature snapshot remains inside the dataset's trusted Business and optional Location scope before the core trainer runs.

```powershell
$env:MONGODB_URI = "<controlled-training-database-uri>"

cd ai-service

python train_no_show.py --dataset-version v1 --model-version experiment-001
```

The script trains:

- class-prior dummy baseline
- logistic regression
- random forest

Model selection occurs on the validation split using PR-AUC. The selected learned model is then evaluated once on the temporal test split.

It is also evaluated against the application's actual `salonai-no-show-risk-rules-v1` implementation.

A learned model receives `candidate` lifecycle status only when its test PR-AUC is higher than the current rules baseline **and** its Brier score is no worse. Otherwise it remains an `experiment`.

Training may emit only `experiment` or `candidate`. It cannot emit `approved` or `production`, and candidate does not mean production approved.

## Metrics

The experiment records:

- ROC-AUC
- PR-AUC
- Brier score
- precision
- recall
- operational threshold
- dummy baseline metrics
- SalonAI rules baseline metrics

For imbalanced no-show prediction, PR-AUC and calibration are important; raw accuracy is not used as the primary selection metric.

## Governed artifacts

Generated model artifacts and metrics are written under:

`ai-service/artifacts/no-show/<dataset-version>/<model-version>/`

This directory is ignored by Git.

Each completed experiment/candidate now produces:

- `model.joblib` — serialized learned pipeline and evaluation metadata;
- `metrics.json` — evaluation evidence;
- `model.manifest.json` — deterministic governance/compatibility evidence.

The manifest binds the artifact to:

- manifest schema version;
- model name/version, task, feature schema, algorithm and lifecycle;
- selected operational threshold;
- exact frozen dataset id/version;
- dataset schema SHA-256 and data SHA-256;
- trusted Business and allowed Location provenance;
- dataset builder/source-collection lineage;
- model-artifact SHA-256 checksum;
- rules-baseline gate result.

The existing MongoDB `AiModelVersion` registry remains authoritative. No second model registry is introduced. The registry's existing `metadata` field records the manifest URI, artifact checksum and dataset governance evidence for later activation checks.

A later controlled artifact store may replace local artifact paths for production promotion, but it must preserve the same manifest and integrity contract.

## Production promotion

Do not change production inference from the rules model until a separate promotion step verifies:

1. frozen dataset lineage and tenant scope;
2. dataset schema/data hashes;
3. model manifest schema and artifact checksum;
4. task and feature-schema compatibility;
5. test-set evidence;
6. calibration and operational threshold;
7. subgroup/data-quality diagnostics;
8. rollback to rules;
9. tenant-aware inference/outcome logging;
10. explicit approved model lifecycle transition.

Production promotion and inference activation are separate controlled operations. The training command does not perform either action.

## Adviser model evidence

When an offline no-show experiment has been written to `AiModelVersion`, the latest learned-model evaluation is exposed to the contextual `Ask SalonAI` experience on appointment/calendar pages.

Only governed evaluation evidence is exposed:

- model name and version;
- lifecycle state;
- algorithm and feature version;
- test PR-AUC, ROC-AUC, Brier score, precision, recall and threshold;
- the equivalent current-rules test metrics;
- whether the learned model beat the rules benchmark under the experiment gate;
- declared limitations.

Artifact paths, checksums, training dataset identifiers and internal governance metadata are not exposed through the Adviser context.

A model with `experiment`, `candidate` or `approved` lifecycle remains explicitly labelled **not active in production**. The Adviser may describe its evaluation evidence, but this integration does not promote the model, change the production no-show predictor or introduce an automatic promotion path.
