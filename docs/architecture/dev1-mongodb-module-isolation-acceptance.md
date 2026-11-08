# DEV1 — Database-backed core module acceptance (initial slice)

Status: isolated CI acceptance only. Not production tenant acceptance or release activation.

## What actually runs

A dedicated GitHub Actions gate (`DEV1 AIIBP Module Mongo Acceptance`) provisions a
temporary MongoDB 7 service and runs `backend/src/acceptance/moduleMongoAcceptance.test.js`
using Node 22. This file is intentionally **outside** the normal
`backend/src/test/*.test.js` unit suite, so unit tests do not require MongoDB.
It fails unless `AIIBP_ACCEPTANCE_MONGO_URI` targets the dedicated
`127.0.0.1:27017/aiibp_module_acceptance_ci` database. The test deletes only
this isolated database before/after the suite. **Never point it at a
development, staging or production database.**

Against actual MongoDB collections and Mongoose queries, the suite tests:
- Two distinct business manifests, separate subscriptions, active vs suspended
  entitlements and module acceptance prerequisite calculations.
- Canonical appointment aggregate reads restricted to business and location;
  foreign-business bookings and legacy unowned bookings must not leak.
- Negative selected-location authority and denied feature-management
  permissions before tenant-wide evidence can be read.
- Active membership resolution where a user from business A cannot select
  business B, using actual BusinessMembership collection lookups.
- No approval, feature activation or autonomous operations.

This is a **test fixture**, not evidence that a particular live tenant or
location has passed acceptance. The management dashboard continues to mark
module-specific database isolation, API acceptance, provider readiness and
production sign-off as **not verified** for real tenants. A later stage
requires signed evidence from the specific deployed commit and live tenant
configuration, backed by appropriate access restrictions.

The separate workflow is path-filtered for the affected scope and can be
dispatched explicitly. Stage 1–6 regression, Fast CI and CodeQL remain
independent gates.

Owner: DEV1. Monthly AI quotas remain explicitly excluded.
