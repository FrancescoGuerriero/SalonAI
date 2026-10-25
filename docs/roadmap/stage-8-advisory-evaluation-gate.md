# Stage 8 — Advisory evaluation and promotion gate

## Purpose

This gate prevents any future model-backed SALON AI adviser from moving toward production merely because it can generate plausible text. Candidate advisory outputs must be evaluated against the canonical location-owned evidence contract and the deterministic Stage 8 baseline first.

## Policy

Policy: `salonai-advisory-evaluation-v1`

Registry: AI Gateway registry v1.2.0.

Minimum offline evaluation:
- 25 cases;
- 3 repeated runs per deterministic case;
- exact citation integrity = 100%;
- factual grounding >= 98%;
- unsupported claim rate <= 2%;
- provenance validity = 100%;
- evidence ID and location identity must match;
- safety flags must pass.

The deterministic baseline is `salonai-canonical-adviser-baseline-v1`.

## Metrics

The assessor checks:
1. evidence/location identity;
2. citation integrity against exact source fact index, name, value and dimensions;
3. factual grounding of summaries, observations, constraints and evidence-derived recommendations;
4. unsupported-claim rate;
5. provenance source validity and coverage;
6. hard safety flags;
7. exact repeatability for deterministic candidates.

The evaluation returns a deterministic assessment hash so results can be referenced in later review evidence.

## Candidate states

Supported evaluation classes:
- `deterministic_baseline`;
- `shadow_model`;
- `offline_model`.

Passing a quality gate does not activate a model. A shadow/offline candidate can at most become `eligible_for_promotion_review`.

The evaluator always returns:
- `production_promotion_authorised = false`;
- `production_inference_authorised = false`.

Automatic promotion is prohibited.

## API

Internal service-key protected governance endpoints:
- `GET /api/v1/ai-gateway/advisory-evaluation-policy`;
- `POST /api/v1/ai-gateway/evaluate-advisory`.

These endpoints assess supplied evidence/output only. They do not invoke, train, tune, promote, schedule or activate a model.

## Benchmark

The dedicated Stage 8 AI Gateway gate runs a 25-case synthetic canonical-evidence benchmark with three repeated baseline runs per case. Cases span several location identities, analyse/summarise/recommend actions, provider comparisons, time-series differences and a no-records constraint case.

The benchmark must remain green before later candidate-model work can use this baseline as a comparator.

## Production boundary

This tranche does not:
- configure or call a production LLM/model provider;
- train or retrain models;
- promote model artifacts;
- enable production inference;
- permit external writes;
- alter campaigns, prices, appointments, customers, staff, communications or payments;
- extend DEV4 multi-tenant work.

All SALON AI evidence remains location-owned. Business-wide management insight remains an authorised aggregation over location-owned facts rather than shared operational ownership.
