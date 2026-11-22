# Module 16 — Analytics & Business Intelligence: DEV1 Source Evidence Acceptance

Owner: DEV1. Requirement `16` in the existing AIIBP v3 Module Catalogue. The registered `analytics` capability pack, Premium Analytics management workspace, Point 10 canonical KPI calculator and Node→Python gateway are established functionality. This work **hardens the existing foundation**, not a second BI module or a second metric catalogue.

## Existing implementation authority

- `GET /api/premium-analytics/management` is protected by authenticated trusted tenant context, effective business/location authority and `premium-analytics:read`.
- Appointment KPI values and definitions belong to the canonical Node `appointmentMetricCalculator.js` and `metricCatalogue.js`, not to Python.
- `POST /api/premium-analytics/management/python-analysis` retains `premium-analytics:read` plus `ai:use`, an explicit single selected Location and audited `AiGatewayInvocation`. Python does not execute actions or recalculate source-of-truth KPIs.
- Point 10 source completion does **not** imply live production or a specific tenant's business-module acceptance.

## New source integrity rules

1. In business-wide mode, the server queries only locations associated with the verified business and excludes archived locations. It now explicitly projects and checks each returned Location's business, status and ObjectId. Duplicate, foreign, archived or malformed location records fail closed with `POINT10_LOCATION_EVIDENCE_INVALID` before any appointment query.
2. Location identifiers are sorted for stable evidence checksums across nondeterministic MongoDB result order. A selected location not found in the queried business-wide scope is refused, not substituted.
3. Selected-mode identifiers are checked for valid MongoDB IDs; unknown location access modes fail closed.
4. The canonical Appointment query continues to filter by the verified business, authorised Location IDs and bounded current/previous UTC windows. It now selects the `business` field and checks each returned row's business and location before calculating metrics. Inconsistent rows fail with `POINT10_APPOINTMENT_EVIDENCE_INVALID` instead of contributing to revenue or bookings.
5. Output still contains aggregate, non-PII management evidence and zero external-write/automation authority. These checks are defence-in-depth against stale, mis-scoped or inconsistent database records; they do **not** replace trusted tenant middleware.

## Validation and restrictions

- `backend/src/test/managementBiScopeEvidence.test.js` verifies business-wide and selected scope, deterministic evidence identities, cross-tenant and missing/duplicate locations, mismatched Appointment business/location, and rejection before aggregation.
- `point10-bi-python.yml` now runs the new tests alongside the original Point 10 contract suite.
- CI on the **exact PR head**, cross-tenant integration acceptance, current deployment identity, live tenant entitlement and independently authorised production sign-off are separate gates.
- No parallel analytics service, tenant-level AI usage quota, product/entitlement changes, browser-to-Python shortcut, provider call, external write, model training, or production deployment is introduced.

## Next Module 16 acceptance stages

A. Confirm source-integrity and all existing CI checks.
B. Validate cross-tenant and location-restricted HTTP requests against the real middleware chain and an isolated database.
C. Validate metrics against known seeded current/previous periods with cancellation, no-show, revenue and timezone edge cases.
D. Collect deployment/runtime/tenant-specific acceptance separately; do not equate a passing PR with production activation.

**Release boundary: DEV1 draft PR only, no merge or deployment without coordination.**
