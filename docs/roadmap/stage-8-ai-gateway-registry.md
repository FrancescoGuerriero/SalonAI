# Stage 8 AI Gateway and Model/Tool Registry

Status: governance source complete for this slice; inference, training and model promotion remain intentionally disabled.

## Purpose

Issue #237 requires the governed Python AI service, AI Gateway and model/tool registry to mature before later AI Adviser, predictive ML, RAG and Natural Computing work is promoted.

This slice does not create a second AI application. It registers the existing Python AI-service capabilities and places a governance contract in front of future orchestration.

## Existing capability registry

The registry describes the current authenticated AI capabilities already exposed by the Python service:

- Haircare Adviser
- Consultation Adviser
- Customer Summary
- Customer Segmentation
- Demand Forecasting
- Sales Forecasting
- Marketing Insights
- No-show Prediction
- Management Copilot
- WhatsApp Bot

Each tool declares:

- capability key and current API route;
- business domain;
- canonical authority/source of truth;
- advisory, predictive or conversational operating mode;
- evidence contract;
- human-approval requirement;
- external-write permission, which is disabled for every registered tool in this slice.

## Model registry

The registry references existing model governance instead of duplicating model storage.

Initial entries include:

- `consultation-booking-baseline`, governed by `app.governance.model_artifact`;
- `forecasting-baselines`, explicitly baseline-first.

Both entries have:

- `productionPromotionAuthorised: false`;
- `trainingAuthorised: false`;
- `baselineComparisonRequired: true`.

## Data Hub evidence contract

`data_hub_evidence_v1` provides the first governed AI evidence envelope for canonical BI facts.

It contains:

- tenant/business identifier;
- evidence identifier and generation time;
- bounded canonical facts;
- bounded provenance references;
- non-secret metadata.

Secret-like metadata keys such as tokens, passwords, API keys, credentials and authorisation values are rejected by schema validation.

The Marketing Insights registry entry explicitly consumes `data_hub_evidence_v1` and declares `aiibp_data_hub` as its authority.

## AI Gateway routes

Authenticated with the existing AI-service service key:

- `GET /api/v1/ai-gateway/registry`
- `POST /api/v1/ai-gateway/plan`

The `plan` endpoint validates that:

1. the requested capability is registered;
2. the evidence envelope matches the capability's registered evidence contract;
3. facts and provenance satisfy bounded schema rules.

A successful plan remains deliberately non-executing:

- `execution_authorised: false`
- `external_write_authorised: false`

It does not call the registered capability, perform inference, train/retrain a model, promote a model, schedule work or perform an external action.

## Governance defaults

The registry is fail-closed:

- canonical facts required;
- tenant context required;
- provenance required;
- human approval required for consequential actions;
- external writes disabled by default;
- production model promotion disabled by default;
- training disabled by default.

## Next controlled slice

After this registry/gateway contract passes CI and security review, the next Stage 8 implementation should connect the Node/AIIBP Data Hub evidence API to this gateway planning contract and record invocation/evidence provenance without enabling production inference. Later capability execution must remain separately authorised and measured against the roadmap's baseline/evaluation gates.
