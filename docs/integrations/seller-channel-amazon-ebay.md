# Seller channels: Amazon Seller Central and eBay

## Implemented in isolated DEV1 draft
The established AIIBP partner-app marketplace is **not** replaced. This change
adds an **opt-in, read-only** Amazon SP-API / eBay Sell adapter beneath the
existing Integration Platform API:

- `GET /api/future/integrations/seller-channels/capabilities`: honest operation/readiness catalogue.
- `GET /api/future/integrations/seller-channels/:connectionId/listings`: bounded listing/inventory snapshot.
- `GET /api/future/integrations/seller-channels/:connectionId/orders`: bounded order-status snapshot.
- `GET /api/future/integrations/seller-channels/:connectionId/fulfillments`: eBay order fulfilment-status snapshot. Amazon intentionally fails closed pending a separately scoped fulfilment implementation.

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
Responses expose only SKU, marketplace listing reference, quantity (when
available), order ID, status, purchase date and total/currency. They do not
expose buyer names, addresses, emails, provider tokens, raw provider objects
or stored credentials. Each response states
`canonicalRecordsWritten: 0` and `publicationEnabled: false`.
Results are current bounded read snapshots, **not** durable synchronisation,
reconciled stock, or an authorisation to ship/refund orders.

## Not completed: provider-dependent scope and acceptance
This code is not production-ready seller-channel integration. It still
requires (a) live authorised Amazon/eBay seller accounts and credentials,
(b) approved provider scopes and successful seller sandbox/production
verification, (c) cursor-based full historical order/listing ingestion,
(c) conflict-safe inventory mapping and canonical upserts with audit/replay,
(d) explicit authorised stock/listing publication workflows and eBay business
policy/offer lifecycle, (e) dedicated returns and shipping/refund workflow
connectors, and (f) real tenant isolation, rate-limit and production acceptance
with representative accounts. Amazon order reads use the current Orders API v2026-01-01 searchOrders operation with PROCEEDS only, excluding buyer and recipient fields. Amazon listing reads use searchListingsItems with the provider maximum page size of 20. Pagination and durable ingestion remain separate work.
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
