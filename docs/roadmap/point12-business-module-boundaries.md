# Point 12 — Business Module Boundaries and Manual Acceptance

## Purpose

Point 12 packages AIIBP capabilities into distinctive commercial modules that can be selected for a Business without duplicating canonical authority. Internal engines and platform dependencies are resolved automatically and are not exposed as competing products.

## Canonical allocation model

Use `allocatableCapabilityPackKeys` from the platform/vertical capability registry. Do not expose internal engines such as `marketing-data`, `campaigns-attribution`, `marketing-automation` or the shared `ai` foundation as separate commercial modules.

Each capability declares `ownedDomains`; the registry fails if active capabilities claim duplicate canonical domains. `moduleInstallationResolver.js` converts a tenant's selected commercial modules into a dependency-closed installation plan.

## Marketing boundary

The Business receives **one Marketing module**. It composes:

- Integration Hub/provider connectivity;
- AIIBP managed and native Data Connections;
- provider-neutral Marketing Data ingestion and lineage;
- CRM audiences/lifecycle/consent evidence;
- canonical Campaign/CampaignExecution/Attribution;
- Marketing Automation triggers/approval/scheduling;
- Communications delivery;
- Analytics & BI;
- governed AI recommendations.

The Marketing module does not replace any of those canonical/internal authorities.

## Manual acceptance checklist

Use a non-production test Business and Location. Do not enter production provider credentials unless a controlled provider acceptance test has been authorised.

### A. Business/module allocation

1. Confirm every expected commercial module appears only once in the tenant allocation experience.
2. Confirm `marketing-data`, `campaigns-attribution`, `marketing-automation` and shared `ai` are internal/non-allocatable.
3. Select each commercial module independently and confirm AIIBP resolves its required dependencies automatically.
4. Confirm Calendar resolves Appointments, Memberships/Loyalty resolve Commerce, and AI assistants resolve their shared AI/operational dependencies.
5. Disable one module entitlement and confirm unrelated modules remain usable.
6. Select all modules supported by a vertical and confirm one valid installation plan is produced without duplicate capabilities.

### B. Marketing module navigation

1. Open `/marketing`.
2. Confirm one Marketing landing workspace appears.
3. Confirm it links internally to Data connections, Native connections, Sellers, Journeys & automation, Attribution & performance and AI marketing assistance.
4. Confirm no connection adapter appears as another top-level commercial module.

### C. Managed Data Connections without adapter configuration

1. In a non-production environment without configured managed-adapter settings, open `/marketing/data-connections`.
2. Confirm the AIIBP catalogue remains visible for planning/search.
3. Confirm a clear “managed data connections are not configured” state is displayed.
4. Confirm connection actions cannot succeed without the server-side adapter configuration.
5. Confirm the browser never receives the managed adapter API key.

### D. Managed source connection

After configuring an approved non-production managed adapter:

1. Search for a supported source such as Google Ads, GA4 or HubSpot.
2. Choose **Connect securely**.
3. Confirm authorization opens the provider/adapter authorization flow in a new tab.
4. Confirm AIIBP does not ask for an ordinary provider password.
5. Complete authorization with a permitted test account.
6. Return to AIIBP and choose **Check connection**.
7. Confirm only account IDs linked through that Business authorization session are shown.
8. Confirm another Business cannot preview, import or unlink those account IDs.

### E. Sellers — Amazon Seller Central

1. Open Marketing → Sellers.
2. Confirm **Amazon Seller Central (Amazon SP)** is listed under Sellers.
3. Connect a permitted test/sandbox account.
4. Reconcile the account and verify Business isolation.
5. Preview a bounded read-only data window.
6. Choose an appropriate seller data profile.
7. Import into the active Location Data Hub.
8. Confirm a location-owned Marketing Data Source and raw/normalised lineage are created.
9. Test Manual / Hourly / Daily / Weekly cadence selection.
10. Run a bounded historical import and inspect saturation reporting.
11. Load seller KPIs and compare them against provider-native evidence.
12. Confirm no listing/product write action is exposed.

### F. Sellers — eBay

1. Confirm **eBay** is listed under Sellers.
2. Connect a permitted test seller account.
3. Verify Business isolation and account reconciliation.
4. Test Orders, Traffic and Promoted Listings profiles where available.
5. Preview and import into the active Location Data Hub.
6. Test scheduled cadence and bounded history import.
7. Load seller KPI summaries and reconcile against provider-native reports.
8. Confirm no listing mutation, payout action or other provider write operation is exposed.

### G. Data Hub ingestion and scheduling

1. From a connected account choose **Import to Data Hub**.
2. Confirm Location is required.
3. Confirm imports use the canonical Marketing Data Core rather than an adapter-specific database.
4. Open the AIIBP Data Hub and confirm source, raw/normalised record, lineage and sync-run evidence.
5. Repeat an import and confirm the existing Data Hub source is updated rather than duplicated.
6. Configure scheduled cadence and confirm `nextRunAt` is populated for automatic schedules.
7. Confirm the shared Marketing Data Sync Worker handles due managed sources.
8. Confirm retry/error evidence remains source/location scoped.

### H. Historical backfill safety

1. Run a date-bounded history import.
2. Confirm requests are date-sliced and bounded.
3. Confirm saturated windows are subdivided.
4. Confirm one-day saturation is explicitly reported and does not claim complete history.
5. Confirm the operation respects the configured request budget.
6. Confirm historical import does not move the normal incremental checkpoint backwards.

### I. Destinations and AI destinations

1. Search for ChatGPT, Claude, Copilot Agent and Power BI.
2. Confirm they are labelled as destinations/AI destinations rather than ordinary Marketing sources.
3. Confirm ordinary source import is not offered for destination-only entries.
4. Destination activation remains a separate governed workflow.

### J. Native versus managed connections

1. Open Native connections and confirm provider-specific connections operate independently.
2. Confirm native and managed modes share AIIBP tenancy/entitlement policy but do not create duplicate commercial modules.
3. Where both modes exist for one provider, confirm the customer sees one provider capability with an understandable implementation mode.
4. Native adapters remain appropriate for deeper first-party verification or separately governed write operations.

### K. CRM separation

1. Review Customer 360, lifecycle and deterministic segment membership.
2. Change test consent/contactability through the canonical customer/consent workflow.
3. Confirm CRM reflects the change.
4. Confirm Marketing Automation consumes that state rather than maintaining a second customer-consent authority.

### L. Communications separation

1. Review templates and scheduled communications.
2. Confirm delivery/templates remain owned by Communications.
3. Confirm Marketing delegates approved delivery to Communications.
4. Confirm Data Connection ingestion itself never sends a customer message.

### M. Analytics and AI assistance

1. Confirm deterministic Data Hub metrics are visible to BI/reporting after import.
2. Open Marketing AI/Business Adviser surfaces.
3. Confirm AI recommendations are based on tenant-owned evidence and retain the appropriate advisory/human-review boundary.
4. Confirm AI cannot reveal credentials, cross-tenant data or silently execute provider writes.

### N. Disconnect/unlink

1. Disconnect an external account from Business A.
2. Confirm unlink is constrained to an account already bound to Business A.
3. Confirm Business B cannot unlink Business A's account.
4. Confirm unlinking the external connection does not silently delete already-ingested historical evidence; data retention/deletion is a separate explicit operation.

## Acceptance outcome

Point 12 is ready for module tidy-up and next-tenant configuration when:

- every business-facing module has a distinctive responsibility;
- every supported commercial module can be selected independently;
- combined module selections produce a valid dependency-closed installation plan;
- no two active modules own the same canonical domain;
- Business and Location isolation pass;
- Amazon/eBay seller workflows pass where required;
- source authorization, preview, import, schedule, history import, KPI and unlink are permission/tenant controlled;
- provider secrets are not exposed to the browser/logs;
- AI remains governed around data and business decisions;
- provider write actions remain disabled unless separately authorised;
- the customer-facing product uses AIIBP-native module terminology.
