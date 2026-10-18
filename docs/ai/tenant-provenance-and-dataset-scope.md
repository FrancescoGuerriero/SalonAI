# AI tenant provenance and governed dataset scope

## Purpose

SalonAI operational Node/Express/MongoDB domains remain authoritative for Business, Location, customer, workforce, appointment, consent and permission state. Python/FastAPI consumes governed evidence and returns predictions, recommendations or proposals; it does not become an operational authority.

This contract prevents AI training, evaluation and inference evidence from silently mixing tenant data as AIIBP expands beyond the original single-business deployment.

## Trusted provenance

`AiFeatureSnapshot` and `AiInferenceLog` support additive provenance fields:

- `business` — canonical `Business` ownership resolved by the backend;
- `location` — canonical `Location` ownership when the evidence is location-specific;
- `vertical` — product/vertical provenance such as Salon AI when relevant.

These values must come from trusted application context or from canonical source records. Request bodies, query strings and arbitrary client headers are not authority for AI tenant ownership.

Existing historical records may not yet contain provenance. Their absence must not be interpreted as permission to include them in a tenant-scoped dataset or tenant-scoped evaluation. Historical backfill or reconciliation is a separate guarded migration concern.

## Training dataset scope

`AiTrainingDataset.scope.mode` has three explicit modes:

1. `single_business` — the restrictive default. The dataset is intended for one Business, with optional Location and vertical restrictions.
2. `cross_business_deidentified` — an explicitly governed dataset that may combine data from more than one Business only after de-identification. `deidentified` must remain `true` and a non-empty `governanceBasis` is required.
3. `platform_global` — platform-level data whose semantics are genuinely global rather than tenant operational data. This mode is not a shortcut for pooling raw tenant records.

Dataset scope is governance metadata, not RBAC. Effective permissions and operational tenant resolution remain enforced by the canonical backend before records are selected.

## No-show dataset activation

The production dataset command is now tenant-scoped and fail-closed. A Business id is mandatory, and an optional Location id is accepted only after the backend verifies that the Location belongs to that Business.

Dry-run example:

```bash
npm run ai:dataset:no-show -- \
  --dataset-version=2026-10-tenant-v1 \
  --business-id=<BUSINESS_OBJECT_ID>
```

Optional Location restriction:

```bash
npm run ai:dataset:no-show -- \
  --dataset-version=2026-10-location-v1 \
  --business-id=<BUSINESS_OBJECT_ID> \
  --location-id=<LOCATION_OBJECT_ID>
```

Applying a frozen dataset still requires the existing explicit confirmation token:

```bash
npm run ai:dataset:no-show -- \
  --dataset-version=2026-10-tenant-v1 \
  --business-id=<BUSINESS_OBJECT_ID> \
  --apply \
  --confirm=build-no-show-training-dataset
```

The materialiser queries canonical `Appointment` records by trusted `business` before feature extraction. Location-specific builds additionally constrain the source query by canonical `location`. Every generated no-show `AiFeatureSnapshot` carries Business provenance, and global deletion of no-show training snapshots is blocked at the model boundary.

Because the existing dataset registry still preserves the historical unique `{name, version}` contract, a dataset version cannot be silently reassigned from one Business to another. Use a new version rather than mutating historical scope. A future reviewed migration may tenant-localise registry uniqueness only after production ownership and compatibility evidence are complete.

## Privacy and lineage

Training snapshots remain pseudonymised by default and record whether direct identifiers are present. Direct customer/staff identifiers should not become model features unless a reviewed task has a documented need and lawful basis.

Frozen datasets retain:

- task and feature version;
- observation window;
- temporal/grouped split policy;
- source-collection lineage;
- schema and data hashes;
- data-quality and readiness evidence;
- explicit tenancy scope;
- builder and source-control provenance where available.

## Python boundary

Python training code must consume governed dataset snapshots or exports derived from them. It must not train directly from unrestricted production collections.

The normal flow is:

```text
canonical tenant-safe operational records
  -> trusted Business/Location resolution
  -> deterministic feature extraction + de-identification
  -> AiFeatureSnapshot
  -> governed AiTrainingDataset scope + frozen lineage
  -> Python training/evaluation
  -> AiModelVersion evidence
  -> tenant-aware inference
  -> AiInferenceLog + outcome/feedback evidence
```

`AiModelVersion` remains the shared model registry. Do not create per-tenant duplicate model registries merely to carry tenancy metadata; model deployment policy may later determine whether a global, vertical or tenant-specific model version is appropriate.

## Fail-closed rules

- Do not infer Business or Location ownership from a customer-supplied identifier.
- Do not treat missing provenance as global/platform permission.
- Do not combine Businesses under `single_business` scope.
- Do not permit `cross_business_deidentified` datasets with `deidentified=false` or without an explicit governance basis.
- Do not freeze new no-show snapshots without trusted Business provenance.
- Do not perform an unscoped destructive rebuild of no-show snapshots.
- Do not copy raw production data into a training directory as a substitute for a governed snapshot.
- Do not let model training, inference or feedback automatically promote a model or mutate consequential canonical state.

## Rollout

The first provenance increment was additive: existing snapshot uniqueness and inference query indexes were preserved while tenant-aware indexes were added. The second increment activates a tenant-bound no-show materialisation path and blocks new unscoped no-show snapshots/destructive rebuilds. Historical ownership backfill, registry uniqueness cutover, tenant-aware inference/evaluation activation and index retirement remain separately reviewed gates.
