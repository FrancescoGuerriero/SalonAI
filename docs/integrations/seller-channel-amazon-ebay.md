# Seller channels: Amazon Seller Central and eBay

## Implemented in isolated DEV1 draft
The established AIIBP partner-app marketplace is **not** replaced. This change
adds an **opt-in, read-only** Amazon SP-API / eBay Sell adapter beneath the
existing Integration Platform API:

- `GET /api/future/integrations/seller-channels/capabilities`: honest operation/readiness catalogue.
- `GET /api/future/integrations/seller-channels/:connectionId/listings`: bounded listing/inventory snapshot.
- `GET /api/future/integrations/seller-channels/:connectionId/orders`: bounded order-status snapshot.
- `GET /api/future/integrations/seller-channels/:connectionId/fulfillments`: eBay order fulfilment-status snapshot. Amazon intentionally fails closed pending a separately scoped fulfilment implementation.
- `GET /api/future/integrations/seller-channels/:connectionId/fulfillments/:orderId`: eBay shipping fulfilment details, including carrier, shipment reference and shipped date, without initiating shipment or returning recipient addresses.
- `POST /api/future/integrations/seller-channels/:connectionId/stage/:kind` (`kind` = `listings` or `orders`): explicit operator-controlled import into separate `SellerChannelStagingRecord` records. Requires `feature-control:update` plus `inventory:read` or `order:read`; uses unique `(business, connection, kind, externalId)` for idempotency and writes an `AuditLog` event. It never changes canonical Commerce records.

All APIs require authentication and trusted Business/Location effective
authority. A connection must belong to the trusted business, use provider
`amazon_seller_central` or `ebay`, and have canonical status `connected`.
The routes require `inventory:read` (listings) or `order:read`
(orders/fulfilments). Capability metadata requires `feature-control:read`.
The route does not allow direct client-selected API origins, user-supplied
business IDs, or creation of provider credentials.

## Existing credentials (never store in source or in responses)
Provider tokens use the existing encrypted `CredentialVersion` bindings on
`IntegrationConnection`. Access is refreshed only when an operator invokes
an authorised read endpoint. The adapter does not persist fresh access tokens.
The account must already be authorised and provisioned by the existing
Integration Platform.

For Amazon Seller Central: `metadata.clientId`, `metadata.sellerId`,
`metadata.marketplaceId` and region `EU`, `NA` or `FE`, plus credential
bindings for `client_secret` and `refresh_token`. Seller account
authorisation and required SP-API roles must already be completed.
Amazon LWA is exchanged at the fixed official OAuth origin.

For eBay: `metadata.clientId`, `metadata.environment` =
`sandbox` or `production` (production default), and credential bindings
for `client_secret` and seller OAuth `refresh_token`. The account requires
the Inventory and Fulfilment read OAuth scopes and applicable seller policies.
eBay OAuth requests are sent to the corresponding official sandbox or
production endpoint only.

## Privacy and reconciliation
Read responses expose only SKU, marketplace listing reference, quantity (when
available), order ID, status, purchase date and total/currency. They do not
expose buyer names, addresses, emails, provider tokens, raw provider objects
or stored credentials. Each response states
`canonicalRecordsWritten: 0` and `publicationEnabled: false`.
Reads are bounded snapshots and the manual stage endpoint persists only a bounded, normalized copy; **neither is** canonical inventory synchronization,
reconciled stock, or an authorisation to ship/refund orders.

## Not completed: provider-dependent scope and acceptance
This code is not production-ready seller-channel integration. The manual staging collection needs indexed MongoDB rollout and real acceptance. It still
requires (a) live authorised Amazon/eBay seller accounts and credentials,
(b) approved provider scopes and successful seller sandbox/production
verification, (c) cursor-based full historical order/listing ingestion,
(c) conflict-safe inventory mapping and canonical upserts with audit/replay,
(d) explicit authorised stock/listing publication workflows and eBay business
policy/offer lifecycle, (e) dedicated returns and shipping/refund workflow
connectors, and (f) real tenant isolation, rate-limit and production acceptance
with representative accounts. Amazon order reads use the current Orders API v2026-01-01 searchOrders operation with FULFILLMENT and PROCEEDS only, excluding buyer and recipient fields. Amazon listing reads use searchListingsItems with the provider maximum page size of 20. Pagination and durable ingestion remain separate work.
Do not activate production or enable external writes based on green unit
tests alone.

## Official documentation
- https://developer-docs.amazon/sp-api/docs/connecting-to-the-selling-partner-api
- https://developer-docs.amazon/sp-api/lang-en_us/reference/searchorders
- https://developer-docs.amazon/sp-api/lang-en_us/reference/searchlistingsitems
- https://developer.ebay.com/develop/guides/sell/authorization
- https://developer.ebay.com/develop/api/sell/fulfillment_api
- https://developer.ebay.com/api-docs/sell/static/inventory/managing-inventory-items.html
- https://developer.ebay.com/develop/api/sell/sell_return

## Bounded pagination and staging completeness


## Explicit resumable staging (server-owned cursor)

Manual staging supports `POST .../:connectionId/stage/:kind?resume=true` to
continue from the last provider page when the existing trusted connection
has an unfinished checkpoint. This requires the same operator permissions
and connected tenant-owned provider account as an initial staging request.
Opaque Amazon page tokens and eBay numeric offsets are **never accepted in
request parameters, API responses, or audit logs**. The checkpoint's provider
cursor is encrypted using the already-required
`INTEGRATION_SECRET_ENCRYPTION_KEY` with AES-256-GCM. On a completed bounded
read, encrypted cursor fields are cleared and `resumeSupported` becomes
false. Missing or invalid checkpoints fail closed, and the original snapshot
records are still staged into a separate collection.

Resume is a **manual partial-page continuation**, not autonomous historical
backfill, long-running background sync, conflict-safe canonical inventory
writeback, or production readiness. Encrypted cursor validity and expiry
are provider-controlled; any rejected/expired token requires an explicit new
import. Simultaneous staging requests and full checkpoint recovery need
separate concurrency/operational acceptance before live activation.

The connector now follows fixed-origin provider pagination internally for a
maximum of **5 pages or 50 normalized records** per operator request.
Amazon Orders `nextToken` is supplied to `paginationToken`; Amazon
Listings `pagination.nextToken` is supplied to `pageToken`.
eBay next-page URLs are parsed for numeric offsets, and only the
allowlisted endpoint is subsequently called. No untrusted next-link
host or pathname is followed. OAuth access-token lengths support
normal provider-issued tokens; they are never returned or logged.

`nextPageAvailable`, `completeWithinLimit` and `pagesFetched`
describe **only the queried time window and bounded snapshot**.
Manual staging copies `sourcePageComplete` and `pagesFetched` into the
audit record and response. Even when `sourcePageComplete=true`, this
does not mean an account's historical orders, inventory, returns or
fulfilment have been reconciled. A multi-run cursor/checkpoint service
and approved canonical Commerce mapping are still required for full sync.

## Tenant reconciliation review and durable observation checkpoint

The new protected `GET /api/future/integrations/seller-channels/:connectionId/reconciliation`
endpoint compares up to 50 staged listings with canonical Commerce SKUs
within the authenticated business. It performs **no writes**. Numeric
stock comparison requires the trusted server-side location authority;
otherwise it reports `location_selection_required`. Missing products,
ambiguous matches and conflicting quantities are explicitly identified,
not silently corrected.

Each explicit staging run updates a tenant- and connection-scoped
`SellerChannelSyncCheckpoint` observation with last observed timestamp,
kind, page count, staged count and whether the bounded source page was
exhausted. `resumeSupported` is true only when an encrypted continuation
cursor is present; a completed run clears the cursor. This bounded manual
resume flow does not prove historical inventory/order synchronization. The unique checkpoint index
is `(business, connection, kind)`, and it is not a Commerce entitlement,
stock adjustment or order reconciliation event.

## Concurrent staging protection

A manual staging/resume invocation now acquires a MongoDB-backed
`SellerChannelImportLease` before contacting either marketplace provider.
The lease is unique on `(business, connection, kind)`: competing imports
for the same tenant-owned seller connection and record type receive HTTP 409
instead of racing on the staging records or the encrypted checkpoint.
A random owner token is used on release, and the lease is released in a
`finally` block after success or failure. An `expiresAt` TTL index
permits recovery of locks orphaned by a crashed process (ten-minute lease);
TTL deletion is asynchronous, so operators may need to retry after expiry.
A lease held past its expiration cannot prevent another import; the
bounded provider read normally completes well inside ten minutes, but
production acceptance must still verify request timeouts, database latency,
index deployment and concurrent behavior.

Both **unique and TTL indexes must be created and verified** before enabling
manual live staging. This lease is not a distributed job scheduler or
autonomous stock synchronization and does not authorise Commerce writes.

## Operator import status (read-only)

The protected `GET /api/future/integrations/seller-channels/:connectionId/import-status`
requires `feature-control:read` and resolves the **existing trusted
business-owned connection**. It reports the listings and orders import
states independently: `idle`, `active`, or
`expired_pending_cleanup` (MongoDB TTL cleanup may lag), plus the
last bounded observation, staged count, pages fetched, and whether an
encrypted continuation can be resumed.

It does **not** call the external marketplace, unlock a lease, reveal
the lock owner, return raw checkpoint records or release opaque cursors.
An expired lease should be treated as *pending cleanup*, not permission
to run another import immediately; the unique index remains the final
admission authority. The import-status view does not certify historical
synchronization or production readiness.

Operator sequence: inspect import status, ensure no active/expired lease
blocks import, initiate a manual stage or explicit resume, then inspect
status and the dry-run SKU reconciliation. No stock/order changes or
external listing/shipping/refund actions are authorised by this workflow.

## Lease ownership fencing before persistent writes

Provider reads may be slow enough for a lease to expire while a request
is active. Before writing staging records, updating the encrypted
checkpoint and recording the audit event, the seller-import service now
performs a conditional MongoDB lease renewal that requires **the original
owner token and an unexpired lease**. If the record has expired or been
replaced, the operation fails with `SELLER_IMPORT_LEASE_EXPIRED`
(HTTP 409), rather than writing observations under another import's lock.
Tests cover expiry, ownership and valid renewal.

These guards substantially reduce stale-owner writes but do not form an
atomic transaction across staging, checkpoint and audit: a database fault
after a staging bulk write can still leave a partially recorded import.
Those records remain tenant-scoped and idempotently upserted. Full
crash-recovery guarantees require a separate transactional or fenced
batch-commit design and production database acceptance before scheduled
synchronisation can be enabled.

## Partial-import journal and recovery review

Every operator-initiated, lease-protected staging request now creates a
tenant-owned `SellerChannelImportRun` journal entry before provider reads.
It records phase progression (`started`, `provider_read`, `staged`,
`checkpointed`, `completed`) or a sanitized `failed` state. The
journal stores no provider token, customer data, listing contents or raw
exception message. If a process crashes, the last run can remain in an
unfinished state; the operator-facing `import-status` endpoint surfaces
`latestRunState`, `latestRunFailureClass` and
`recoveryReviewRequired` without claiming completion.

The journal is **diagnostic rather than transactional**. A crash after a
staging bulk write can still leave idempotently staged records without
a checkpoint; this must be inspected and replayed under a fresh lease.
The import remains manual and produces no canonical Commerce writes.
MongoDB unique indexes, failure recovery and multi-process acceptance
must be verified before production activation.

## Recovery-review gate before retries

A failed or unfinished `SellerChannelImportRun` cannot be silently replaced
by another manual staging request. Under the same unique tenant/connection/kind
lease, the service inspects the most recent run and **fails closed** with HTTP
409 `SELLER_RECOVERY_REVIEW_REQUIRED` before contacting Amazon or eBay
unless an authorised operator explicitly sends JSON
`{"recoveryAcknowledged":true}` on the existing staging POST request.

Operators should inspect `import-status`, review the failed phase and
staged records, and choose a manual fresh import or explicit encrypted-cursor
resume. This acknowledgement records intent only: **it does not roll back,
repair, delete, or automatically reconcile prior records**, nor does it make
external shipping, payment or Commerce mutations. It is not a substitute
for database transactions or production recovery acceptance.
