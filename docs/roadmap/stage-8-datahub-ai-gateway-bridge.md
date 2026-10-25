# Stage 8 Data Hub → AI Gateway Planning Bridge

Status: source implementation complete for the planning bridge; inference and external actions remain disabled.

## Purpose

This slice connects the governed Node/AIIBP Data Hub to the Stage 8 Python AI Gateway without creating a second source of truth or enabling production inference.

The existing Data Hub `aiibp.data-hub.evidence` contract is preserved for compatibility. A translation layer converts that deterministic evidence into the Python gateway's `data_hub_evidence_v1` envelope.

## Evidence translation

The bridge consumes the existing Data Hub query/saved-view evidence and produces:

- tenant/business identifier;
- deterministic evidence ID;
- bounded canonical facts;
- bounded provenance references;
- safe, non-secret metadata.

Canonical totals and row-level metrics/calculated metrics are reused as facts. Python is not asked to recalculate canonical BI metrics.

Limits:

- maximum 500 facts;
- maximum 200 provenance references;
- maximum 20 dimensions per fact.

## Provenance

Provider/source provenance is derived from the existing tenant-scoped Data Hub evidence, including source ID, provider and generation time. If the canonical query has no source records, the bridge uses a deterministic empty-source provenance marker so the gateway schema remains explicit rather than fabricating provider evidence.

## Endpoints

The existing endpoint remains unchanged:

- `POST /integration-platform/data-hub/ai-evidence`

New read-permission endpoints:

- `POST /integration-platform/data-hub/ai-gateway/evidence`
  - generates the translated envelope locally;
  - does not contact the AI service.

- `POST /integration-platform/data-hub/ai-gateway/plan`
  - builds the translated evidence;
  - sends it to `/api/v1/ai-gateway/plan` on the governed Python service;
  - receives a governance plan only.

## Configuration

The planning bridge accepts:

- `AI_SERVICE_BASE_URL` or compatibility alias `AI_SERVICE_URL`;
- `AI_SERVICE_SERVICE_KEY` or compatibility alias `AI_SERVICE_KEY`.

It fails closed with `AI_GATEWAY_NOT_CONFIGURED` if configuration is absent. Production requires an HTTPS AI-service base URL.

The service key is transmitted only in the service-to-service `X-SalonAI-Service-Key` header and is never placed into the evidence envelope.

## Safety boundary

The bridge does not call any analyse/infer/train/promote endpoint. The Python gateway plan endpoint itself remains non-executing.

Bridge responses explicitly report:

- `inferenceExecuted: false`;
- `externalWriteAuthorised: false`.

This slice does not:

- execute inference;
- train/retrain a model;
- promote a model;
- schedule AI work;
- activate production AI-service configuration;
- perform external writes;
- deploy to production.

## Next controlled slice

After CI/security validation, Stage 8 can add auditable AI invocation/evidence records and a management preview surface before any capability execution is considered. Consequential execution must remain separately authorised and measured against deterministic/statistical baselines.
