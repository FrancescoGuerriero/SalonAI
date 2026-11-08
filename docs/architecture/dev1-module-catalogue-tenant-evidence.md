# DEV1 — Trusted tenant module composition evidence

Status: **source-only**; no production deployment or activation.

This slice extends the read-only Module Management dashboard from #599–#600.
An additional authenticated `GET /api/system-administration/module-catalogue/tenant-evidence`
reads only the **server-resolved trusted business**. It uses existing
`trustedTenantContextMiddleware`, `effectiveAuthorityMiddleware`, and
`feature-control:read` permission enforcement.

Because subscription and manifest composition are **business-wide**, the
evidence endpoint requires `locationAccessMode = all`. A staff membership
limited to selected locations cannot inspect a business-wide plan.

The service reads existing `TenantProductManifest` and
`TenantSubscription` records using business-constrained queries. It
verifies returned ownership, active manifest integrity via the existing
SHA-256 manifest calculator, manifest effective date, plan agreement,
subscription plan version, and registered entitlement grants.

For catalogue entries mapped to existing capability packs, it exposes
`manifestSelected` and `subscriptionEntitled` from the saved
tenant records and resolved product composition. This is **not** evidence
of an enabled feature at runtime: feature switches, platform safety
locks, provider configuration, per-location activation, release deployment
and actual production acceptance are distinct checks and remain unknown.

The UI displays these facts beside the reviewed source/CI evidence, with
separate unknown deployment and acceptance fields. It does not reveal
billing-provider tokens, customer records, entitlement grant limits, or
any other tenant's product state.

## Known boundaries

- Missing records return explicitly unknown evidence rather than defaults.
- Foreign ownership, manifest tampering and future-effective manifests fail
  closed; no guesses from the GitHub catalogue are substituted.
- No write endpoints, subscriptions edits, billing actions, module toggles,
  provider calls or AI monthly quota capabilities are added.
- This is **tenant configuration evidence**, not independent live runtime
  verification. The endpoint intentionally does not claim otherwise.
- Before production: database-backed isolation tests, true server-side
  runtime/provider acceptance signals, deployment-artifact provenance,
  operational verification, and authorised acceptance sign-off are still
  required.

Owner: DEV1 only. Source merge is not a production deployment.
