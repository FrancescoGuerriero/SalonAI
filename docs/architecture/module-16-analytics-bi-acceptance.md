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

## Legacy Premium Analytics privacy closure

The older `GET /api/premium-analytics` compatibility endpoint aggregated loyalty, gift-card, referral, notification, campaign, and retention data without a business/location predicate. Because those historical aggregates cannot safely be attributed to an effective tenant, the root controller **now rejects requests with HTTP 410** and `PREMIUM_ANALYTICS_LEGACY_UNSCOPED_DISABLED`; it performs no database queries. This is an intentional compatibility-breaking security change, not a claim that its legacy metrics are now tenant-ready.

The current Premium Analytics frontend already uses `GET /api/premium-analytics/management`, which remains available under trusted tenancy and effective RBAC. External clients still using the legacy JSON shape must migrate to the governed management endpoint or a separately validated business-owned reporting contract. Do not re-enable the historic cross-tenant aggregation as a fallback.

`managementBiLegacySurface.test.js` verifies retirement, no unscoped operational reads, authenticated routing and the management UI migration path.

## Runtime Analytics entitlement enforcement

The canonical management read and governed Python analysis endpoints now require the server-side `requireManagementBiEntitlement` middleware **after** the trusted tenant and effective permission middleware. This is not a separate analytics capability catalogue: the checker reuses the existing persisted `TenantProductManifest`, `TenantSubscription`, hash verifier, canonical tenant subscription lifecycle, registered capability packs and validated composition resolver.

A request is denied before any BI appointment query or Python invocation unless all of the following hold:

- An authenticated trusted Business and location-scoped effective authority have already been resolved, and the required `premium-analytics:read` permission has been granted (plus `ai:use` for Python).
- An active, properly owned tenant product manifest and a properly owned subscription record exist; the manifest hash, plan, registered composition and effective date are valid.
- The tenant subscription is lifecycle-eligible according to **existing** `resolveTenantEntitlements` rules (`trial`, `active` and `past_due` remain eligible); the `analytics` capability is explicitly entitled, and enabled in the canonical vertical composition. Suspended, cancelled and missing grants fail closed.
- The global `premium-analytics` platform switch remains enforced by `app.js` `requireFeature`, not replaced or reinterpreted by this middleware.

The verifier is **read-only** and has no tenant-wide subscription-inspection endpoint. Selected-location employees with legitimate BI permissions may access only their own scoped aggregates without needing `feature-control:read`. Refused responses contain error codes, not subscription details or customer records. `managementBiEntitlement.test.js` covers missing/foreign source records, hashes, plan mismatches, future effective dates, lifecycle states, missing grants, vertical defaults and the fail-closed middleware. The isolated MongoDB HTTP suite verifies the same denied states with the canonical production router.

**Rollout risk:** Enforcing this gate is intentionally stricter than the former permission-only endpoint. Tenant installations without populated, integrity-verified product manifests and subscriptions will receive HTTP 403 until their already-defined tenant provision/migration workflow supplies verified evidence. Do not bypass the gate, automatically backfill live tenants, or claim that local CI proves live subscription activation. Capture deployment-specific migration readiness and tenant entitlement acceptance separately.

## Validation and restrictions

- `backend/src/test/managementBiScopeEvidence.test.js` verifies business-wide and selected scope, deterministic evidence identities, cross-tenant and missing/duplicate locations, mismatched Appointment business/location, and rejection before aggregation.
- `point10-bi-python.yml` now runs the new tests alongside the original Point 10 contract suite.
- CI on the **exact PR head**, cross-tenant integration acceptance, current deployment identity, live tenant entitlement and independently authorised production sign-off are separate gates.
- No parallel analytics service, tenant-level AI usage quota, product/entitlement changes, browser-to-Python shortcut, provider call, external write, model training, or production deployment is introduced.

## Real MongoDB and guarded HTTP acceptance (new)

The separate `DEV1 Module 16 BI Mongo Acceptance` GitHub Actions gate starts an **ephemeral MongoDB 7** service on the CI runner's loopback interface. Its test requires exactly `mongodb://127.0.0.1:27017/aiibp_bi_acceptance_ci`, refuses other connection strings and drops the isolated test database on completion. It never connects to the live database.

`backend/src/acceptance/managementBiMongoAcceptance.test.js` seeds two businesses, two active locations for one business, a separate other-tenant location and an archived location. Appointment fixtures include completed work, no-shows, cancellations, an `appointmentDate` fallback, exact current/previous UTC window boundaries, an excluded future record, a foreign business, and legacy records without verified business/location ownership. It checks exact canonical bookings, completed revenue, no-show and cancellation rates for business-wide, single-location and other-tenant queries, plus source row counts and zero writes.

The same acceptance suite serves an isolated HTTP endpoint using the **production trusted-context and effective-permission middleware factories**, the actual `getManagementBi` controller and real MongoDB models. It verifies the response contract, explicit permission denial, missing principal denial and tenant/location-specific results. Only the test harness substitutes authentication and server-selected tenant identities; it does **not** assert production JWT validation, customer session selection or live role-registry acceptance. Production router wiring remains protected and unchanged.

All results remain deterministic and non-PII. This is database-backed acceptance, **not deployment evidence**.

### Real authentication, persisted tenancy and role enforcement

A second isolated real-Mongo test mounts the **actual canonical `premiumAnalyticsRoutes`** rather than a replacement route. The unmodified production middlewares verify a signed access JWT against the persisted User, resolve the request hostname against active BusinessDomain/Business records, verify active BusinessMembership ownership and location grants, resolve built-in role permissions, and then call the canonical management BI controller.

The test seeds separate authenticated users, two businesses and their active domains, a deliberately suspended cross-business membership, distinct location-limited memberships, an unprivileged receptionist, inactive user, suspended membership, and unowned legacy appointment facts. It checks the following real HTTP behaviours:

- Valid signed token + active tenant A admin membership returns only the permitted A location.
- Tenant B admin returns only B metrics and cannot access tenant A through foreign Host selection.
- Changing the Host to B with only a suspended B membership is denied.
- `x-forwarded-host`, arbitrary tenant headers and query-based business/location IDs cannot override a server-resolved host and persisted membership.
- Receptionist lacking the effective BI permission is refused. Disabled users, suspended memberships, malformed tokens and unknown/disabled domains are refused.
- Root legacy Premium Analytics remains HTTP 410 with no unscoped aggregates.

**Test scope:** The test uses actual JWT verification, persisted DB membership and role resolution, domain-host selection and the production premium route middleware chain. It mounts the route in a minimal isolated Express harness (instead of the full application `requireFeature` mount); live reverse-proxy deployment, tenant entitlement and subscription enforcement remain separately unverified. Test tokens are signed only with the CI environment's configured test secret; no actual user credentials or production accounts are used.


## Next Module 16 acceptance stages

A. Confirm source-integrity and all existing CI checks.
B. Validate cross-tenant and location-restricted HTTP requests against the real middleware chain and an isolated database.
C. Validate metrics against known seeded current/previous periods with cancellation, no-show, revenue and timezone edge cases.
D. Collect deployment/runtime/tenant-specific acceptance separately; do not equate a passing PR with production activation.

**Release boundary: DEV1 draft PR only, no merge or deployment without coordination.**
