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

## Privacy and lineage

Training snapshots remain pseudonymised by default and record whether direct identifiers are present. Direct customer/staff identifiers should not become model features unless a reviewed task has a documented need and lawful basis.

Frozen datasets must retain:

- task and feature version;
- observation window;
- temporal/grouped split policy;
- source-collection lineage;
- schema/data hashes;
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
- Do not copy raw production data into a training directory as a substitute for a governed snapshot.
- Do not let model training, inference or feedback automatically promote a model or mutate consequential canonical state.

## Rollout

This provenance change is additive. Existing snapshot uniqueness and inference query indexes are preserved while tenant-aware indexes are added. Any historical ownership backfill, uniqueness cutover, tenant-aware materialiser activation or index retirement requires a separately reviewed migration/readiness gate.
