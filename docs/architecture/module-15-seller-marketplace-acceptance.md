# Module 15 — Seller & Marketplace Management: Implementation and Acceptance

Owner: DEV1. Branch: `dev1/seller-channels-amazon-ebay-20261108`. PR: #611.

## Implemented in this branch

- Tenant-owned Amazon Seller Central and eBay connection records; provider read adapters for eligible listings, orders, and the implemented eBay fulfilment/return review surfaces.
- Explicit, manual listings/orders source staging, with checkpoint/lease handling, isolated transaction support, recovery guards, and real MongoDB rollback acceptance.
- Read-only marketplace SKU candidate review and formula-safe CSV report. Canonical Commerce Product remains authoritative. No stock variance is accepted until a provider listing/location-to-Commerce location mapping is independently verified.
- **Audited location-mapping proposals (not approvals):** `GET/POST /api/future/seller-channels/:connectionId/location-mapping-proposals` allow tenant-wide operators to review or nominate a single staged listing, business-owned Commerce Product and active Commerce Location. The staging, product and location ownership checks, proposal insert and audit event occur inside one MongoDB transaction; a uniqueness constraint prevents conflicting candidates for the same seller listing. There is no provider-location verification, activation, automatic mapping or stock-difference calculation from proposals.
- **Terminal candidate withdrawal:** `POST /api/future/seller-channels/:connectionId/location-mapping-proposals/:externalListingId/withdraw` requires an authorised operator and one of five predefined reasons. A conditional state transition and audit event commit together or neither commits; the withdrawn proposal remains visible but permanently ineligible for approval or re-creation under the same unique reference. This is an audit/recovery safeguard, not proof of provider location or permission to change stock.
- Read-only marketplace order state inspection; explicit order association proposal, review statuses, financial/ownership preflight, batch review, and CSV review.
- Operator-created *pending* order association proposal with scoped staged order and scoped Commerce order lookup, duplicate protection, and an audit event in one MongoDB transaction.
- Operator hold/reopen for proposed association with structured reason, transactionally committed audit, and collision rejection.
- Checkout can assign business ownership **only** from authenticated, server-resolved tenant context; legacy unowned orders remain unverified.
- Seller API is mounted at `/api/future/seller-channels`; its own trusted tenant and permission middleware is applied inside the authenticated router.
- Tenant-scoped merchant seller connection list and on-demand read-only Amazon/eBay `POST /:connectionId/diagnose` endpoint, including status redaction and clear read-vs-write distinction.
- Existing Partner Marketplace management panel now includes seller account discovery, read diagnostics, staging controls, inventory and order-link review, and pending proposal/hold/reopen controls.
- Amazon Seller Central connector now captures the seller ID and marketplace ID required for the SP-API adapter.
- An eBay OAuth seller connector definition and read-only live account verifier are registered using the canonical Integration Platform; no auto-creation of external consent or credentials.

## Security and data invariants

1. Business identity and permissions come from server-side tenant authority; user-supplied tenant IDs do not grant access.
2. The seller staging dataset has no location ownership. Seller review routes demand business-wide authority.
3. Provider order IDs, buyer email, and matching totals do not establish trusted Commerce order correspondence.
4. Proposals are **not** approvals. Holds, reopen events, and pending proposals do not create or alter Commerce Orders, products, refunds, fulfilments, stock or provider data.
5. All association mutations here require an explicit operator and a transaction; no non-transactional fallback or partial audit.
6. A legacy Commerce Order with no proven `business` is excluded from linkage. A cancelled/refunded order is not review-ready even when totals match.

## Acceptance evidence

- Dedicated `.github/workflows/dev1-seller-transaction-acceptance.yml` now runs the ownership, proposal, transition, CSV, provider-adapter, staging and reconciliation unit suites.
- Real loopback replica-set tests cover staging rollback, index uniqueness, Commerce business filtering, operator hold/reopen rollback, and operator proposal rollback/duplicate protection.
- The broader Stage 1–6, Fast CI, Module Mongo acceptance, Data Hub and CodeQL checks are independent release gates. Check the **exact PR head commit** before citing them as passed.
- Existing test fixtures are not proof of live Amazon/eBay API permissions, rate-limit behaviour, or in-market transactions.

## Merchant test sequence (requires authorised seller accounts)

1. Connect each Amazon Seller Central and eBay seller through the Integration Platform using their own consent and secure credential bindings. Never paste secrets in a GitHub issue or chat.
2. On the Partner Marketplace screen, choose a connected account and run **Test read access**. Record the check time and listing/order read outcomes. Zero returned records can be valid but does not establish that the entire inventory or transaction history was covered.
3. Stage listings and orders explicitly. Verify staging checkpoints and recovery evidence with the scoped import-status endpoint.
4. Review SKU candidates using only a trusted canonical Commerce location. **A selected Commerce location is not marketplace-location proof**: the current Amazon/eBay source snapshots do not establish provider-location ownership. Until an auditable mapping exists, the review returns `marketplace_location_mapping_required`, no confirmed matches, and **null canonical quantities and stock differences**. Do not interpret source quantities as location inventory.
5. Propose a marketplace SKU-to-Commerce-location **candidate** only where the listing exists in tenant-owned staging, the Product matches the SKU and belongs to the active Commerce Location, and the operator has tenant-wide inventory/product read plus feature-control update rights. These validations prove only local ownership, not external stock location; inspect the pending proposal and its audit before provider evidence is obtained.
6. Propose a marketplace/Commerce order link only for an order carrying explicit trusted business ownership. Hold ambiguous links; preserve the operator audit.
7. Capture sandbox then production provider-side acceptance evidence for catalog creation/publication, quantity updates, order mapping, shipment posting and return/refund requests before enabling any corresponding write path.
8. Repeat the complete CI matrix on the exact release commit and obtain owner sign-off. **Do not claim full module acceptance from a passing CI build alone.**

The eBay Inventory API requires an inventory item, a valid merchant location, an offer and seller business policies before publishing. Amazon requires product-type definitions and correct SP-API authorization for listing writes. Neither is safely inferred from existing generic Commerce Product records.

## Unaccepted production functionality — must not be silently marked complete

| Domain | Production acceptance requirement |
|---|---|
| Amazon Seller Central | Real account consent/credential rotation, SP-API scope, throttling and pagination, product listings, inventory and order round-trip validation |
| eBay | Real seller consent/credential rotation and scope, pagination, listing/order/fulfilment/return status verification, error and retry behaviour |
| Association approval | Authoritative same-transaction correlation, immutable provider evidence, stale-evidence detection, actor/decision audit, two-person control where required, and conflicting association race tests |
| Listing publication | Approved publish/update/unpublish capability with idempotency, field validation, rollback/retry and provider production acceptance |
| Stock writeback | Canonical Commerce inventory authority, reservation/stock semantics, provider-specific idempotency and conflict reconciliation, manual/automated safety controls |
| Provider location mapping | A proposal-only candidate schema and audited transaction are implemented; still requires **trusted source listing/fulfilment-location evidence**, an independent approval/revocation lifecycle, stale-evidence rechecks, handling of multi-location/aggregated quantities, indices in production, and provider-side acceptance. Current staged Amazon/eBay snapshots do **not** prove a source location. Proposals cannot activate matching or stock writes. |
| Orders | Trusted marketplace transaction ingestion to Commerce; payment/tax/shipping/returns provenance, duplicate/idempotent processing and cancellation reconciliation |
| Fulfilment and returns | Provider write permissions, lifecycle mapping, shipment updates, refund/return controls and production acceptance |
| UI / operations | User-facing seller connection setup, actionable operations and review screens, support diagnostics, merchant acceptance and release sign-off |

## Go/no-go

**Status: development-complete for the currently implemented read-only and manually controlled proposal/review foundation; NOT production-complete for the full Seller & Marketplace Management module.**

Do not activate a seller writeback or describe this module as fully operational until the unaccepted functions have executable tests, live-provider verification and reviewed operational approval. Do not merge/deploy independently without release authorisation.
