# Point 12 — Business Module Boundaries and Manual Acceptance

## Purpose

Point 12 packages existing AIIBP capabilities into distinctive business modules that can be allocated to a Business without duplicating canonical authority. Marketing is one business-facing module; Windsor, campaign/attribution and automation engines remain internal implementation capabilities.

## Canonical allocation model

Use `allocatableCapabilityPackKeys` from the platform/vertical capability registry. Do not expose internal engines such as `marketing-data`, `campaigns-attribution`, `marketing-automation` or the shared `ai` foundation as separate commercial modules.

Primary business-facing areas include Booking & Operations, Workforce & Staff, Commerce, Inventory & Purchasing, CRM & Customer Intelligence, Communications, Integration Hub, Analytics & BI, Marketing and supported AI assistants. Each capability declares `ownedDomains` and the registry fails if active capabilities claim duplicate canonical domains.

## Marketing boundary

The business receives **one Marketing module**. It composes:

- Integration Hub/provider connectivity;
- Windsor-style Marketing Data ingestion and lineage;
- CRM audiences/lifecycle/consent evidence;
- canonical Campaign/CampaignExecution/Attribution;
- Marketing Automation triggers/approval/scheduling;
- Communications delivery;
- Analytics & BI;
- governed AI recommendations.

The Marketing module does not replace any of those canonical/internal authorities.

## Manual acceptance checklist

Use a non-production test Business and test Location. Do not enter production provider credentials unless a controlled provider acceptance test has been authorised.

### A. Business/module allocation

1. Confirm `marketing` is allocatable to a supported Business.
2. Confirm `marketing-data`, `campaigns-attribution` and `marketing-automation` are internal/non-allocatable.
3. Confirm shared `ai` is internal/non-allocatable while supported business-facing AI assistants can be allocated separately.
4. Disable Marketing entitlement and confirm Marketing surfaces are unavailable/clearly not entitled without disabling unrelated Booking/Workforce/Commerce capabilities.
5. Re-enable Marketing and confirm its internal dependencies resolve without presenting them as duplicate modules.

### B. Marketing module navigation

1. Open `/marketing`.
2. Confirm one Marketing landing workspace appears.
3. Confirm it links internally to Windsor data connections, Native connections, Sellers, Journeys & automation, Attribution & performance and AI marketing assistance.
4. Confirm Windsor does not appear as another top-level business module.

### C. Windsor runtime without configuration

1. In a non-production environment with no `WINDSOR_API_KEY`, open Windsor data connections.
2. Confirm the catalogue remains visible for planning/search.
3. Confirm a clear “Windsor is not configured” state is displayed.
4. Confirm connection actions cannot succeed without the server-side key.
5. Confirm the browser never receives the `WINDSOR_API_KEY`.

### D. Windsor source connection

After configuring a non-production Windsor API key:

1. Search for a supported source such as Google Ads/GA4/HubSpot.
2. Choose **Connect securely**.
3. Confirm authorization opens the Windsor/provider flow in a new tab.
4. Confirm AIIBP does not ask for the provider password.
5. Complete the provider/Windsor connection with a sandbox/test account.
6. Return to AIIBP and choose **Check connection**.
7. Confirm only account IDs connected through that Business authorization session are shown.
8. Confirm a different Business cannot preview/import/unlink those account IDs.

### E. Sellers — Amazon Seller Central

1. Open Marketing → Sellers.
2. Confirm **Amazon Seller Central (Amazon SP)** is listed under Sellers, not generic advertising.
3. Connect a permitted test/sandbox seller account through Windsor.
4. Reconcile the account.
5. Confirm account name/ID appears only for the active Business.
6. Preview a bounded read-only data window.
7. Use **Import to Data Hub** with an active test Location.
8. Confirm a location-owned Marketing Data Source is created/updated and a sync run records imported raw/normalised evidence.
9. Confirm no Amazon listing/product write action is exposed.

### F. Sellers — eBay

1. Confirm **eBay** is listed under Sellers.
2. Connect a permitted test seller account through Windsor OAuth.
3. Reconcile the account and verify Business isolation.
4. Preview seller data.
5. Import a bounded window into the active Location Data Hub.
6. Confirm the Data Hub source retains Windsor/eBay connector and account provenance.
7. Confirm no listing mutation, payout action or other eBay write operation is exposed.

### G. Windsor Data Hub ingestion

1. From a connected Windsor account choose **Import to Data Hub**.
2. Confirm Location is required.
3. Confirm the first import is bounded (currently maximum 100 Windsor rows per manual request).
4. Open the AIIBP Data Hub.
5. Confirm the Windsor source appears as a canonical Marketing Data Source rather than a separate Windsor-only database.
6. Confirm raw and normalised record lineage/sync-run evidence is present.
7. Repeat the same import and confirm canonical deduplication/reconciliation behaviour does not create a competing source definition.
8. Do not treat this manual bounded import as proof of full historical/backfill support; scheduled/paginated ingestion requires separate acceptance.

### H. Destinations and AI destinations

1. Search for ChatGPT, Claude, Copilot Agent and Power BI.
2. Confirm they are labelled as destinations/AI destinations rather than ordinary Marketing data sources.
3. Confirm the ordinary source Connect/Import workflow is not offered for destination-only entries.
4. Destination activation must remain a separate governed workflow.

### I. Native versus Windsor connections

1. Open Native connections and confirm existing provider-specific connections still operate independently.
2. Confirm the architecture does not create a second native credential store for Windsor.
3. Where a provider has both Windsor and native support, confirm the UI/product documentation explains the connection mode rather than presenting two business modules.
4. Native adapters remain appropriate for deeper first-party verification or later governed write operations; Windsor remains broad read/analytics connectivity.

### J. CRM separation

1. Open a test customer.
2. Review Customer 360, lifecycle and deterministic segment membership.
3. Change test consent/contactability through the canonical customer/consent workflow.
4. Confirm CRM reflects the change.
5. Confirm Marketing Automation consumes that state rather than maintaining a second customer-consent authority.

### K. Communications separation

1. Review templates and scheduled communications.
2. Confirm delivery/templates remain owned by Communications.
3. Confirm Marketing chooses approved audiences/actions but delegates delivery.
4. Confirm Windsor data import itself never sends a customer message.

### L. Analytics and AI assistance

1. Confirm deterministic Marketing/Data Hub metrics are visible to BI/reporting after import.
2. Open Marketing AI/Business Adviser surfaces.
3. Confirm AI can explain/recommend from canonical evidence but is labelled advisory/human-reviewed where required.
4. Confirm AI cannot reveal provider credentials, Windsor API/session tokens, cross-tenant account data or silently execute connector/write actions.

### M. Disconnect/unlink

1. Disconnect a Windsor account from Business A.
2. Confirm the unlink operation is constrained to an account ID already bound to Business A.
3. Confirm Business B cannot unlink Business A's account.
4. Confirm disconnecting the external account does not delete already-ingested canonical historical Data Hub evidence without a separate explicit data-retention action.

## Acceptance outcome

Point 12 connector/module architecture is ready for the later module tidy-up when:

- each business-facing module has a distinctive responsibility;
- Marketing is a single allocatable module;
- Windsor/native connection modes do not create duplicate canonical authorities;
- Business and Location isolation pass;
- Amazon/eBay seller workflows pass;
- source authorization, preview, import and unlink are permission/tenant controlled;
- provider secrets are never exposed to the browser/logs;
- AI remains advisory around connector/data decisions;
- Windsor write operations remain disabled unless separately authorised;
- scheduled/full historical ingestion is not enabled until pagination, windowing, rate limits and retry behaviour are accepted.
