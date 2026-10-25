# Stage 8 — AI candidate governance workspace

## Purpose

This workspace provides an operator-facing view of the location-owned AI candidate evaluation ledger introduced in the preceding Stage 8 tranche.

It deliberately separates two concerns:

- **AI readiness/advisory** — inspect canonical evidence, validate plans and generate cited deterministic advisory previews;
- **AI candidate governance** — inspect offline/shadow candidate evidence, benchmark progress, artifact provenance and human promotion-proposal review state.

The governance workspace is not a model-execution surface.

## Route and authority

Route:

`/admin/system/ai-candidate-governance`

Inspection requires `feature-control:read`.

Human review decisions require `feature-control:update`.

The backend remains authoritative for both permissions and all location scoping.

## Location ownership

The workspace displays records returned for the active SALON AI location only.

Each row exposes bounded governance metadata such as:

- candidate kind/version;
- governed model/artifact identity;
- quality and baseline status;
- benchmark-suite progress;
- review status;
- evaluation time.

It does not create a business-shared operational AI record pool.

## Benchmark readiness

The UI exposes the server-recorded promotion-readiness fields:

- qualifying vs required distinct evidence cases;
- recorded vs required runs for the current case;
- quality-gate result;
- baseline-comparison result;
- blocker codes.

Under the current evaluation policy the server requires 25 qualifying evidence cases and at least three recorded runs per case before a candidate can become `pending_review`.

The UI does not calculate or override eligibility.

## Human review

An authorised reviewer may choose:

- **Accept for promotion proposal**; or
- **Reject candidate**.

Acceptance produces `accepted_for_promotion_proposal`. This means only that the candidate may be considered in a later, separately governed promotion proposal.

It does not activate or promote a model.

## Production boundary

The workspace intentionally contains no model:

- training control;
- inference control;
- activation control;
- promotion control;
- external-write control.

The page explicitly states that production promotion, inference and external writes remain disabled. The corresponding backend ledger fields remain hard-locked to false.
