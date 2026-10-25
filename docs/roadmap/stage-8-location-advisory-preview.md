# Stage 8 — SALON AI location advisory preview

## Purpose

This tranche turns the Stage 8 Data Hub → AI Gateway planning foundation into the first governed SALON AI advisory capability without enabling production model inference or autonomous actions.

Operational evidence remains owned by one SALON AI location. A business-wide management view may aggregate across locations only through separately authorised reporting; the underlying AI evidence and advisory invocation remain location-scoped.

## Capability

The first governed capability is `marketing-insights`.

The operator workflow is:

1. select a saved Data Hub view or the default 30-day location query;
2. preview canonical evidence and provenance;
3. optionally validate the AI Gateway plan;
4. generate a deterministic advisory preview for `analyse`, `summarise`, or `recommend`;
5. inspect evidence citations attached to each observation/recommendation;
6. review the location-owned governance ledger before making any operational decision.

`forecast` remains planning-only. Advisory forecast execution returns `AI_ADVISORY_FORECAST_REQUIRES_GOVERNED_MODEL` until a predictive model has passed baseline comparison and model-promotion gates.

## Deterministic baseline

The baseline implementation is:

`salonai-canonical-adviser-baseline-v1`

It consumes only `data_hub_evidence_v1` canonical facts. It may compare exact canonical fact values and identify observed provider/time-series differences. It does not redefine or recompute canonical BI metric formulae.

Every cited fact includes:

- evidence ID;
- fact index;
- canonical fact name;
- exact fact value;
- fact dimensions.

The response also retains the AI registry version and provenance source IDs.

## Authority and permissions

- evidence preview and planning history: existing Stage 8 read authority;
- advisory generation: `ai:use` permission;
- business and location scope: existing effective authority middleware;
- all audit records require both `Business` and `Location` ownership.

## Safety boundary

The advisory preview is deliberately non-autonomous:

- `deterministicBaseline = true`;
- `modelInferenceExecuted = false`;
- `inferenceExecuted = false` at the backend bridge;
- `executionAuthorised = false`;
- `externalWriteAuthorised = false`;
- `humanApprovalRequired = true`.

The tranche does **not**:

- train or retrain a model;
- promote a model artifact;
- activate production inference;
- schedule AI execution;
- change provider execution locks;
- send messages or alter campaigns;
- change prices, appointments, customers or staff records;
- execute payments or refunds;
- perform any external write.

## Audit

Successful advisory previews are persisted as `AiGatewayInvocation.status = advisory_previewed` with:

- location/business ownership;
- requested user;
- tool and requested action;
- evidence ID and checksum;
- fact/provenance counts;
- safe source/provider summary;
- registry/advisory version summary;
- recommendation count;
- hard false inference/execution/external-write flags.

Credentials and raw provider secrets are never stored in the advisory audit record.

## Future gate

A later Stage 8 tranche may introduce a model-backed or generative adviser only after an explicit controlled decision covering evaluation, baseline comparison, provenance/citation guarantees, model artifact governance and production activation. This deterministic adviser remains the baseline comparator.
