# Stage 8 — Evidence-derived baseline comparison

## Purpose

Stage 8 model candidates must not become promotion-ready because an artifact manifest simply declares that it beats the deterministic rules baseline. This tranche introduces a location-owned comparison ledger that derives the decision from recorded evaluation evidence.

## Ownership

Every comparison belongs to the active SALON AI business and selected location. Candidate and deterministic-baseline evaluation records must match on:

- business and location
- tool key
- requested action
- canonical evidence ID
- evaluation policy version
- deterministic baseline version

Cross-location, cross-evidence and cross-policy comparisons fail closed.

## Promotion boundary

A shadow/offline candidate now has three baseline-comparison states:

- `manifest_declaration` — informational only; cannot make the artifact promotion-eligible
- `evidence_derived` — produced by a governed comparison record
- `not_applicable` — deterministic baseline records only

The candidate model validation hook forces `baselineComparisonPassed=false` and `artifactPromotionEligible=false` for model candidates unless an `evidence_derived` comparison record is attached.

Promotion proposal dossier creation also independently requires:

- `baselineComparisonSource === "evidence_derived"`
- a baseline comparison record reference
- baseline comparison passed
- artifact promotion eligibility
- full benchmark-suite gate
- completed human promotion-proposal review

This protects older persisted candidate records that may have a historical manifest-derived boolean.

## Metric comparison

The comparison ledger stores candidate value, deterministic-baseline value, delta, direction and non-degradation result for:

Higher is better:

- citation integrity rate
- factual grounding rate
- provenance validity rate
- provenance coverage rate

Lower is better:

- unsupported claim rate

It also requires identity and safety non-degradation and sufficient repeated-run evidence.

Possible metric directions are `better`, `equal`, or `worse`; the aggregate metric decision is `better`, `equal`, `worse`, or `mixed`.

## Benchmark-suite interaction

When a comparison passes, the candidate evaluation is upgraded to `baselineComparisonSource=evidence_derived`. The service then re-counts distinct qualifying evidence cases for the same:

- business/location
- tool
- candidate kind/version
- artifact SHA-256
- policy version
- baseline version

Only records with evidence-derived baseline passage, quality passage, artifact eligibility and sufficient repeated-run evidence count toward the 25-case suite.

Human promotion review remains required after the suite gate passes.

## Non-executing boundary

This comparison layer performs no model execution and adds no training, deployment, activation, production inference, production promotion or external-write path.

All comparison records hard-lock:

- `productionPromotionAuthorised=false`
- `productionInferenceAuthorised=false`
- `deploymentAuthorised=false`
- `externalWriteAuthorised=false`
