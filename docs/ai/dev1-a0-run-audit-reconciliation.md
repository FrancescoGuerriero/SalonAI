# DEV1 — AIIBP v3 A0 run/audit reconciliation

Status: source-only, internal read-only diagnostic. DEV1 sole owner.

## Purpose and canonical sources

The `inspectAiMetricsRunAuditIntegrity` service checks existing
`AiAgentRun` and `AuditLog` evidence for the canonical
`business.metrics.read` tool. It does not create another audit model,
execute a tool, modify state, or attempt automatic repairs.

The caller must have a trusted Business ID, `ai:use` and `reports:read`
effective permissions. A location filter comes from the existing shared AI
Workforce location-authority service. Run queries are scoped by Business,
authorised Location(s), agent key and metadata purpose; audits are scoped to
the same Business and a bounded set of run IDs.

## Reconciliation signals

- `stale_started_run`: an in-progress run exceeds the configured age.
- `missing_terminal_audit`: completed/failed run without matching audit.
- `duplicate_terminal_audit`: multiple audit entries for one run.
- `audit_scope_or_status_mismatch`: terminal status, tool key or Location differs.
- `invalid_start_time`: missing, malformed or future start timestamp.

Only IDs, status, location and issue codes are returned. No customer details,
metric values, prompts, secrets or credentials appear in diagnostics.

## Operational boundaries

- Maximum 100 recent runs per inspection; minimum stale threshold 60 seconds.
- The report explicitly indicates when the limit may truncate results.
- No public endpoint, scheduled worker, repairs, retry or production activation
  is provided here.
- This is a *detection* gate, not a guarantee of transactional audit writes.
  Later implementation should use durable evidence/outbox patterns and
  controlled reconciliation with explicit operator approval.
- Live MongoDB isolation and failure-injection tests, metrics, alerts and
  tenant usage quotas remain additional acceptance requirements.

## Verification

Negative tests assert permission denial, foreign location denial, bounded
run/audit queries, malformed data handling and expected discrepancy labels.
Stage 1–6 regression, Fast CI, CodeQL and AI validation are required.
