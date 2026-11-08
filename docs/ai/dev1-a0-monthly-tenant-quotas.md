# DEV1 — AIIBP v3 A0 metrics monthly quota admission

Status: **source-only, internal**, not a billing meter or production activation.

## Authority

The quota is resolved from the existing persisted `TenantSubscription.entitlementGrants`.
A tenant must have exactly one `ai-a0-metrics-monthly` grant with a positive
integer `limit` between 1 and 1,000,000. Missing, zero, malformed or
unbounded values fail closed. The existing subscription lifecycle,
manifest integrity, entitlement, enabled feature, RBAC and location checks
remain prerequisites. The new grant must be provisioned explicitly before
this internal path can be activated; existing tenant records are not changed.

## Metering and concurrency

`AiToolMonthlyUsage` is an aggregate counter, uniquely indexed by
business, `business.metrics.read` tool and UTC calendar month.
`reserveAiMetricsMonthlyAdmission` initializes a counter idempotently
and then uses a separate conditional MongoDB `findOneAndUpdate` with
`admittedCount < limit` and atomic `$inc`. It does not execute a read
when the tenant has exhausted its allocation. A duplicate unique-key
initialisation race may retry only the admission condition; database
errors fail closed.

The trusted tenant entry point performs identity, request-shape,
read-permission and preflight authorisation checks **before** quota
admission. It then invokes the existing audited A0 metrics reader.
The counter records admitted attempts, including reads that later time
out or fail. No automatic credit/refund, retry, usage billing, customer
messaging or mutations are performed.

## Operational limitations

This is a simple monthly per-tenant admission quota, not a token budget,
cost model, concurrency cap, or authoritative invoice ledger.
Full live acceptance still requires MongoDB-backed concurrent multi-tenant
tests, index creation/migration readiness, usage reporting with trusted
authority, alerts and operational quotas, timeouts and failure injection.
No public endpoint, schedule or production rollout is added.

DEV1 is the sole development and release owner.
