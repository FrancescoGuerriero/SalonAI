# Module 15 — Seller & Marketplace Management: Implementation and Acceptance

Owner: DEV1. Branch: `dev1/seller-channels-amazon-ebay-20261108`. PR: #611.

## Implemented in this branch

- Tenant-owned Amazon Seller Central and eBay connection records; provider read adapters for eligible listings, orders, and the implemented eBay fulfilment/return review surfaces.
- Explicit, manual listings/orders source staging, with checkpoint/lease handling, isolated transaction support, recovery guards, and real MongoDB rollback acceptance.
- Read-only SKU inventory variance preview and formula-safe CSV report. Canonical Commerce Product remains authoritative.
- Read-only marketplace order state inspection; explicit order association proposal, review statuses, financial/ownership preflight, batch review, and CSV review.
- Operator-created *pending* order association proposal with scoped staged order and scoped Commerce order lookup, duplicate protection, and an audit event in one MongoDB transaction.
- Operator hold/reopen for proposed association with structured reason, transactionally committed audit, and collision rejection.
- Checkout can assign business ownership **only** from authenticated, server-resolved tenant context; legacy unowned orders remain unverified.

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

## Unaccepted production functionality — must not be silently marked complete

| Domain | Production acceptance requirement |
|---|---|
| Amazon Seller Central | Real account consent/credential rotation, SP-API scope, throttling and pagination, product listings, inventory and order round-trip validation |
| eBay | Real seller consent/credential rotation and scope, pagination, listing/order/fulfilment/return status verification, error and retry behaviour |
| Association approval | Authoritative same-transaction correlation, immutable provider evidence, stale-evidence detection, actor/decision audit, two-person control where required, and conflicting association race tests |
| Listing publication | Approved publish/update/unpublish capability with idempotency, field validation, rollback/retry and provider production acceptance |
| Stock writeback | Canonical Commerce inventory authority, reservation/stock semantics, provider-specific idempotency and conflict reconciliation, manual/automated safety controls |
| Orders | Trusted marketplace transaction ingestion to Commerce; payment/tax/shipping/returns provenance, duplicate/idempotent processing and cancellation reconciliation |
| Fulfilment and returns | Provider write permissions, lifecycle mapping, shipment updates, refund/return controls and production acceptance |
| UI / operations | User-facing seller connection setup, actionable operations and review screens, support diagnostics, merchant acceptance and release sign-off |

## Go/no-go

**Status: development-complete for the currently implemented read-only and manually controlled proposal/review foundation; NOT production-complete for the full Seller & Marketplace Management module.**

Do not activate a seller writeback or describe this module as fully operational until the unaccepted functions have executable tests, live-provider verification and reviewed operational approval. Do not merge/deploy independently without release authorisation.
