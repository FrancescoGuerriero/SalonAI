# AIIBP v3 — DEV1 AI Workforce operational hardening: feature controls and evidence

Status: internal source-only; no public AI tool invocation route, tenant activation or deployment.

## Canonical feature enforcement

The trusted AI tenant resolver now checks the existing persisted
`feature.ai-tools.enabled` setting before authorising invocation.
A disconnected SystemSetting database, explicitly disabled value, or
malformed override blocks use. A connected database with no override
continues using the existing default-enabled feature definition,
but **subscription entitlement and capability composition are also mandatory**.
No second feature registry was created.

## Canonical metric evidence

The A0 invocation allows only keys defined in the canonical
`APPOINTMENT_METRIC_KEYS` catalogue. Every metric must:
- have a registered key with no duplicates;
- match the registered definition version, unit and label;
- have a finite numeric value;
- pass the definition's effective-authority permissions.

Other domain metrics are not silently granted. This does not enable
new sources, mutations, A1+ autonomy, scheduling or provider access.

## Acceptance and follow-up

Tests cover persisted feature disabled/unavailable/malformed states,
unknown/duplicate/stale/nonfinite metric evidence and permission failures.
Required merge gates: Stage 1–6 full regression, Fast CI, CodeQL and AI training validation.

Before a live endpoint: real MongoDB-backed cross-tenant isolation tests,
audited run/outcome reconciliation, dependency timeouts and cancellation,
production feature-flag configuration, observability and per-tenant quotas.

DEV1 sole implementation owner; no production operations in this PR.
