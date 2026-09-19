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

## Materialise a dataset

Configure a dedicated pseudonym key. Do not reuse the JWT/OAuth secrets.

PowerShell example:

```powershell
$env:AI_DATASET_PSEUDONYM_KEY = "<dedicated-random-secret-at-least-32-characters>"

cd backend

# Read-only preview. No AI dataset rows are changed.
npm run ai:dataset:no-show -- --dataset-version=v1

# Freeze the dataset only after the dry-run summary is acceptable.
npm run ai:dataset:no-show -- --dataset-version=v1 --apply --confirm=build-no-show-training-dataset
```

The apply command refuses to freeze a dataset with fewer than 30 eligible resolved observations. A dataset below 100 observations is explicitly marked with a small-dataset warning.

The frozen data is stored in `AiFeatureSnapshot` and registered in `AiTrainingDataset`.

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

The runtime requirements are also installed so the evaluation can call the exact current SalonAI rules implementation.

## Train and evaluate

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

Candidate does not mean production approved.

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

## Artifacts

Generated model artifacts and metrics are written under:

`ai-service/artifacts/no-show/<dataset-version>/<model-version>/`

This directory is ignored by Git.

The MongoDB `AiModelVersion` registry stores the model metadata and artifact reference. A later controlled artifact store will replace local artifact paths for production model promotion.

## Production promotion

Do not change production inference from the rules model until a separate promotion step verifies:

1. frozen dataset lineage;
2. test-set evidence;
3. calibration and operational threshold;
4. subgroup/data-quality diagnostics;
5. model artifact integrity;
6. rollback to rules;
7. inference/outcome logging;
8. approved model lifecycle transition.

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

Artifact paths, training dataset identifiers and internal model metadata are not exposed through the Adviser context.

A model with `experiment`, `candidate` or `approved` lifecycle remains explicitly labelled **not active in production**. The Adviser may describe its evaluation evidence, but this integration does not promote the model, change the production no-show predictor or introduce an automatic promotion path.
