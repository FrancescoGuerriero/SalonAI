# Stage 8 — AI baseline delta evidence

## Purpose
Persist auditable candidate-vs-deterministic-baseline comparison evidence for the same SALON AI business, location, tool and evidence case.

## Comparison requirements
A shadow/offline candidate must have a matching deterministic baseline evaluation with:
- the same business;
- the same location;
- the same tool key;
- the same evidence ID;
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

Identity, safety and reproducibility are also required to remain non-degraded.

The existing artifact-manifest `beatsRulesBaseline` assertion remains evidence, but it is not sufficient by itself. A comparison passes only when the manifest assertion is true and every recorded non-degradation check passes.

## Auditability
Each comparison is location-owned and binds:
- candidate evaluation ID;
- deterministic baseline evaluation ID;
- evidence ID;
- candidate version;
- baseline version;
- artifact SHA-256;
- per-metric deltas;
- blockers;
- comparison hash.

## Safety boundary
This evidence layer does not train, deploy, activate, promote or execute production inference. Production promotion, production inference, deployment and external-write flags are hard-locked false.

The subsequent tranche can make this comparison evidence an explicit prerequisite for human promotion review after this ledger has passed CI and security gates.
