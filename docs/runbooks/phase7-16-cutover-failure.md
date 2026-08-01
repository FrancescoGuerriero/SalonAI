# Phase 7.16 cutover failure runbook

## Immediate actions

1. Stop further manual changes.
2. Preserve `deployment-evidence/phase7-16`.
3. Record the active change ticket, operator names and UTC time.
4. Review `cutover-failure.json` and the latest Phase 7.14 deployment evidence.
5. Determine whether the failure occurred before deployment, during deployment,
   during smoke testing or during hypercare.

## Before deployment

When strict preflight fails, do not override it. Resolve the pending or failed
item and rerun the dry run.

Typical blockers:

- Phase 7.15 readiness evidence is not approved;
- release or rollback manifest is missing or invalid;
- backup evidence is stale;
- restore-test reference is missing;
- current time is outside the approved change window;
- production environment or Compose validation fails.

## After deployment starts

Use the approved rollback manifest. Do not construct a tag-based rollback and do
not edit image digests manually.

The cutover script permits rollback only when both are supplied:

- `-RollbackOnFailure`
- `-ConfirmRollback "ROLLBACK-SALONAI-PRODUCTION"`

If rollback is not authorised in the current invocation, run the existing
guarded rollback procedure separately after approval.

## Hypercare failure

A hypercare failure means the release must not be closed as successful.

Review:

- `/healthz`
- `/api/health/ready`
- `/ai/health`
- `/`

Check edge, backend, AI-service, MongoDB, Prometheus, Grafana and tracing logs.
Preserve the failed `hypercare.json`.

## Closure

Use `CLOSE-SUCCESS` only when `cutover-complete.json` and passed
`hypercare.json` exist.

Use `CLOSE-ROLLED-BACK` only after rollback is confirmed and
`cutover-failure.json` exists.
