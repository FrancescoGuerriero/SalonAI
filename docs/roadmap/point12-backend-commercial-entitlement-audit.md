# Point 12 — Backend Commercial Entitlement Audit

**Status:** Phase A source audit in progress  
**Branch:** `dev1-point12-marketing-automation`  
**Purpose:** distinguish commercial entitlement-ready APIs from legacy APIs that require tenant/data-model hardening first.

## Acceptance invariant

Commercial entitlement is a separate authority from authentication and RBAC. A staff-facing commercial API is only entitlement-ready when it has a trusted Business/Location authority chain before `requireCommercialModule(...)`, and its underlying reads/writes are tenant scoped.

Do not add entitlement middleware over globally scoped data and treat the module as tenant-safe.

## Entitlement-enforced backend families

The following source families now enforce commercial module entitlement in addition to their existing operation permissions:

| Commercial module | Backend family | Boundary |
| --- | --- | --- |
| Services | management service APIs | authenticated tenant context → effective authority → `services` entitlement → service RBAC |
| Analytics | reports/export APIs | trusted tenant context → effective authority → `analytics` entitlement → report/export RBAC |
| Seller & Marketplace | managed Data Connections and tenant marketplace installations | trusted tenant context → effective authority → `seller-marketplace` entitlement → feature-control RBAC |
| Communications | campaigns, templates, scheduled communications, staff delivery APIs | authenticated tenant context → effective authority → `communications` entitlement → communications RBAC |
| Memberships | plans, contracts, collections and benefits | trusted tenant context → effective authority → `memberships` entitlement → customer RBAC |
| Clinical Records | regulated clinical APIs | trusted tenant context → effective authority → `clinical-records` entitlement → regional/location clinical eligibility → clinical RBAC |
| Workforce & Staff | self-service and workforce scheduling APIs | trusted tenant context → effective authority → `staff` entitlement → schedule/employee RBAC |
| CRM | lead/opportunity APIs | trusted Business/Location context → effective authority → `crm` entitlement → customer/communications RBAC |

## Deliberate exclusions

These surfaces must not be swept into a commercial entitlement boundary without separate design approval:

- public Service catalogue browsing;
- signed Twilio provider status webhook;
- shared `/admin/system/connections` platform workspace;
- published customer-experience content;
- platform/core administration endpoints.

Their existing authentication/signature/publication contracts remain the relevant boundary.

## Tenant hardening required before entitlement

### Loyalty

Current canonical `LoyaltyAccount` is keyed globally by `customer` and does not carry canonical Business ownership. The canonical controller can list all loyalty accounts and resolve/update an account by customer without Business filtering.

**Decision:** do not add `loyalty` commercial entitlement yet. First complete the stored-value/tenant migration design, including Business ownership, uniqueness/index changes, compatibility/backfill strategy and Business A/Business B isolation tests.

This remains consistent with `tenant-domain-migration-inventory.json`, which already places loyalty in the commerce/inventory/stored-value migration domain and requires controlled migration evidence before production writes.

### Inventory

The legacy inventory service currently performs global `InventoryItem.find`, `findById`, `findByIdAndDelete` and create operations without effective Business/Location authority being passed into the service.

**Decision:** do not add `inventory` commercial entitlement until the data access layer is Business/Location scoped and cross-tenant resource IDs fail closed.

### Business Planning / Revenue Forecasting

Revenue forecast snapshots are currently created without Business/Location ownership and list/get/delete operations are global (`find`, `countDocuments`, `findById`, `findByIdAndDelete`).

**Decision:** Business Planning entitlement must wait for tenant-owned forecast snapshots and tenant-scoped forecast source evidence.

### Customer Experience

The current customer-experience profile/offer aggregation still contains user-global and globally queried records, including profile upsert by user only and shared reads of offers/loyalty/notification-style evidence.

**Decision:** keep published/customer flows under their existing contracts and tenant-harden the management/data model before adding the commercial `customer-experience` entitlement to the whole router.

### Remaining CRM surfaces

CRM lead/opportunity APIs are now protected, but this does not imply that every customer profile, segment, follow-up, retention or premium automation endpoint is entitlement-complete.

**Decision:** audit each CRM-owned route family independently and only extend the `crm` entitlement where trusted tenant authority and data ownership are already explicit.

## Safe next implementation order

1. Continue route-family inventory for CRM, Commerce, Calendar and Appointments.
2. Add entitlement only where trusted tenant/effective authority and tenant-owned data access already exist.
3. For globally scoped legacy services, create tenant-hardening work before entitlement wiring.
4. Preserve public/provider callback exceptions explicitly in regression contracts.
5. Re-run Point 12, Stage 1–6, Fast CI and CodeQL after each coherent slice.

## Production boundary

This audit and its source changes do not authorise production migrations, backfills, provider writes, credential activation, worker activation, model promotion or deployment. Tenant-data migrations remain controlled operations requiring dry-run, backup, reconciliation, rollback evidence and integration approval.
