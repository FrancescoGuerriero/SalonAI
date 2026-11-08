# DEV1 — AIIBP module catalogue management dashboard

Status: source implementation; not production deployed or independently accepted.

## Implementation

- Authenticated backend GET `/api/system-administration/module-catalogue` under
  the existing `protect` and `feature-control:read` permission middleware.
  It exposes a fixed read-only catalogue projection; no tenant-specific
  configuration, entitlements, customer data or activation operations.
- Frontend route `/admin/module-catalogue` within the existing management
  shell, protected by `PermissionRoute(feature-control:read)`.
- Advanced management navigation entry under **Configure the business**.
- Search by requirement ID, name, source status and AI opportunity; filters
  for fifteen canonical categories and P0–P3 priorities; proposed candidate
  visibility; expandable details for source status, AI opportunity, dependency,
  mapping, permissions and independent readiness axes.
- Unknown deployment, provider, entitlement, ingestion and production
  evidence is explicitly shown as unknown instead of inferred as success.
  The view cannot enable a module or create subscriptions.
- This dashboard uses the source taxonomy from PR #598, not a second
  deployable capability registry.

## Delivery and acceptance limits

The source catalogue remains a planning baseline, including historical
observations such as PR #586. Runtime and provider status are not
verified or automatically refreshed in this slice; no fabricated evidence
URLs or acceptance dates are presented.

Follow-on: independently verified evidence ingestion from current
GitHub CI/deployment artifacts and tenant configuration, permission-scoped
runtime acceptance records, filtering of evidence by authorised tenant,
and browser accessibility acceptance. No module activation from catalogue
data. Monthly AI quotas are excluded from scope per explicit decision.

DEV1 sole development owner. No production deployment in this PR.
