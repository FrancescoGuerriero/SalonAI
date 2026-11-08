# AIIBP v3 — DEV1 A0 Metrics Invocation & Audit

Status: **source-only, unactivated**. DEV1 sole development owner.

## Canonical integration

The internal `invokeGovernedBusinessMetrics` service uses existing:
- `previewAiWorkforceToolInvocation` for fresh A0 authority, agent, tool, RBAC, location, capability, vertical and entitlement checks;
- `buildManagementCopilotPayload` for canonical, tenant-aware Appointment metric aggregates;
- `AiAgentRun` for versioned execution provenance;
- `AuditLog` for a minimal invocation event.

The service does **not** run a language model, initiate a campaign, create an appointment, invoke an external provider or publish content. No public route or automation is activated.

## Security and acceptance gates

1. Require an authenticated user and integer period from 1 to 365 days.
2. Recheck trusted effective authority and active matching tenant composition **at invocation time**; preview output is not a bearer token.
3. Require shared AI pack, vertical and entitlement authorisation; register no tool dynamically.\n   The canonical Appointment metrics reader additionally requires `appointment:read`, beyond the tool-registry `ai:use` permission.
4. Allow only the built-in Business Adviser with registered low-risk `business.metrics.read` at A0.
5. The canonical metrics service applies the trusted business/location filter and returns aggregate results; the invocation checks the reported scope against the requested scope.
6. Reject missing or foreign scope, unbounded metric arrays, foreign selected locations, missing permissions and audit failures.
7. Persist the run and a minimal success/failure audit event with timestamps, scope, tool key and metric count. Never persist raw metric values, prompts, customer records or secrets in AuditLog.
8. Keep all consequential actions human-controlled; direct mutation remains prohibited.

## Remaining work before activation

- Integrate the server-side composition/entitlement resolver in a trusted route or service boundary (never HTTP-body-supplied).
- Add DB-backed negative tenant/location integration tests and source-of-truth consistency checks.
- Validate minimal metrics response schema, values and metric-level permissions.
- Add run/audit reconciliation, durable event behaviour and bounded retry/timeout controls.
- Add evaluation sampling, latency/cost budgets and alerting; run full CI/CodeQL and controlled production acceptance.

No production changes or deployment performed by this slice.
