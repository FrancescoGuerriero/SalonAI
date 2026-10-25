# Stage 8 — Offline / shadow experiment runner

## Purpose

This tranche adds a governed experiment harness for evaluating `shadow_model` and `offline_model` advisory candidates against canonical SALON AI location evidence before any production inference is considered.

The runner sits upstream of the existing candidate evaluation ledger. It does not create a new promotion path. Each successful experiment case is handed to the existing `evaluateAndRecordCandidate(...)` service, so the same citation integrity, factual grounding, provenance, safety, reproducibility, artifact and benchmark-suite gates remain authoritative.

## Ownership boundary

Every experiment run is bound to:

- one Business;
- one selected Location;
- one governed model artifact checksum;
- one candidate version;
- canonical evidence from that same location.

Operational data remains location-owned. The experiment ledger stores bounded audit summaries and references to evaluation records, not raw evidence or candidate payloads.

## Repeatability rules

A run contains 1–25 evidence cases.

Each case requires 3–10 actual repeated candidate outputs. The runner:

1. verifies every repeated output uses the same location, evidence ID and candidate version;
2. hashes the repeated outputs itself;
3. requires the primary candidate output to appear exactly in the repeat set;
4. sends those computed hashes into the existing evaluation service.

This prevents callers from manufacturing reproducibility by submitting arbitrary hashes.

## Recorded comparison evidence

For each case the experiment ledger records:

- evidence ID;
- resulting candidate-evaluation record ID;
- quality-gate result;
- artifact baseline-comparison result;
- repeated-run sufficiency;
- promotion-review eligibility;
- evaluation metrics;
- blockers or bounded failure metadata.

The run summary records counts for completed cases, quality-pass cases, baseline-pass cases, reproducible cases and promotion-review-eligible cases.

## Safety boundary

This runner does **not**:

- train or tune a model;
- invoke a production model endpoint;
- deploy an artifact;
- promote an artifact;
- enable production inference;
- authorise external writes.

The persisted flags remain hard locked to `false` for production promotion, production inference, deployment and external writes.

## API

- `POST /integration-platform/data-hub/ai-gateway/offline-experiments` — run a governed offline/shadow experiment (`ai:use`)
- `GET /integration-platform/data-hub/ai-gateway/offline-experiments` — list location-owned runs (`feature-control:read`)
- `GET /integration-platform/data-hub/ai-gateway/offline-experiments/:runId` — inspect one run (`feature-control:read`)

## Next maturity step

The next safe tranche is an operator-facing experiment comparison workspace that visualises artifact versions, case-level metrics, baseline results, reproducibility and benchmark progress without adding any production execution control.
