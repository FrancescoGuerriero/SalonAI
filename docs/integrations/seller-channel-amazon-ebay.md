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
