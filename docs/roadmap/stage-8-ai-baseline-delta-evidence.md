# Stage 8 — AI baseline delta evidence

## Purpose
Persist auditable candidate-vs-deterministic-baseline comparison evidence for the same SALON AI business, location, tool, action, policy and canonical evidence case, then use that evidence as an explicit promotion-readiness prerequisite.

## Comparison requirements
A shadow/offline candidate must have a matching deterministic baseline evaluation with:
- the same business;
- the same location;
- the same tool key;
- the same requested action;
- the same canonical evidence ID;
- the same evaluation policy version;
- the baseline version declared by the governed evaluation policy;
- a passing deterministic baseline quality gate.

If the matching baseline evaluation is absent, comparison evidence is not created.

## Explicit metric deltas
The comparison records candidate value, baseline value, signed delta, direction and non-degradation verdict for:
- citation integrity rate — higher/equal is non-degraded;
- factual grounding rate — higher/equal is non-degraded;
- unsupported claim rate — lower/equal is non-degraded;
- provenance validity rate — higher/equal is non-degraded;
- provenance coverage rate — higher/equal is non-degraded.

Identity, safety, reproducibility and sufficient repeated-run evidence are also required.

The artifact-manifest `beatsRulesBaseline` assertion is preserved separately as `baselineManifestAssertion`, but it is not promotion authority and is not sufficient by itself.

## Candidate-ledger enforcement
Model-candidate evaluations now track:
- `baselineManifestAssertion`;
- `baselineComparisonSource`;
- `baselineComparisonEvidence`;
- `baselineComparisonPassed`.

Before an evidence-derived comparison is attached, candidate validation fails closed by forcing:
- `baselineComparisonPassed=false`;
- `artifactPromotionEligible=false`;
- `eligibleForPromotionReview=false`;
- `promotionReadiness.qualifyingOfflineCases=0`;
- `promotionReadiness.suiteGatePassed=false`;
- non-final review state to `not_eligible`.

A deterministic baseline uses `baselineComparisonSource=not_applicable` and can never become artifact-promotion eligible.

## Benchmark-suite interaction
After a comparison passes, the comparison service attaches the evidence record to the candidate and re-counts distinct qualifying evidence cases for the same:
- business/location;
- tool and requested action;
- candidate kind/version;
- artifact SHA-256;
- policy version;
- baseline version.

Only records with:
- passing quality gate;
- `baselineComparisonSource=evidence_derived`;
- a non-null baseline-comparison evidence reference;
- passing evidence-derived baseline comparison;
- artifact promotion eligibility;
- sufficient repeated-run evidence

can contribute to the 25-case benchmark suite.

The comparison evidence snapshots `qualifyingOfflineCases`, `requiredOfflineCases` and `suiteGatePassed` for operator review.

## Human review and promotion dossier boundary
Passing baseline comparison and the full benchmark suite can only move a candidate to `pending_review`.

Promotion-dossier creation separately requires:
- completed human promotion-proposal review;
- quality gate passed;
- `baselineComparisonPassed=true`;
- `baselineComparisonSource=evidence_derived`;
- a baseline comparison evidence reference;
- artifact promotion eligibility;
- full suite gate passed.

This additional check protects historical/legacy candidate records whose old baseline boolean may have originated only from the manifest declaration.

## Operator visibility
The existing `/admin/system/ai-offline-experiments` comparison workspace now loads the baseline-comparison ledger and displays:
- candidate and deterministic baseline values;
- signed per-metric deltas;
- non-degradation direction/verdict;
- identity/safety/reproducibility checks;
- repeated-run sufficiency;
- blockers;
- qualifying/required benchmark cases;
- suite-gate state.

The workspace remains read-only.

## Safety boundary
This evidence layer does not train, deploy, activate, promote or execute production inference. Production promotion, production inference, deployment and external-write flags remain hard-locked false.
