# Stage 8 — Marketing provider executor wave 2: commerce and revenue evidence

Authority: AIIBP Roadmap v2.9 Stage 8 and Issue #237.

## Scope

Wave 2 adds read-only Shopify and Stripe executors so the AIIBP Data Hub can reconcile marketing activity against external order/payment evidence through the existing Marketing Data Core lineage pipeline.

## Shopify

- GraphQL Admin API version `2026-10`.
- Admin endpoint is constructed only from a validated `*.myshopify.com` shop domain.
- Uses the governed encrypted `access_token` credential.
- Reads the `orders` connection only; no GraphQL mutations are implemented.
- Filters by created date and paginates by Shopify cursor.
- Captures order ID, date, source/channel, received revenue and refunded amount.
- Uses `totalReceivedSet.shopMoney` for gross collected revenue and `totalRefundedSet.shopMoney` for refunds.
- Bounded by maximum records and page count.

Shopify ordinarily exposes the most recent 60 days of orders with `read_orders`; older history requires separately approved all-orders access. The executor does not request or assume expanded historical access.

## Stripe

- Uses `GET https://api.stripe.com/v1/charges` only.
- Uses the governed `api_key` credential; connection metadata may optionally specify a connected Stripe account ID.
- Filters charges by bounded created timestamp window.
- Paginates with `starting_after`, maximum 100 objects per request.
- Captures payment ID, date, currency, successful-payment count, captured revenue and refunded amount.
- Converts Stripe minor-unit amounts into ordinary currency units, including zero-decimal and common three-decimal currencies.
- Failed/unpaid charges contribute no payment count or revenue.
- Refund evidence is taken from the read-only `amount_refunded` field on the Charge object; no refund-creation endpoint is used.

## Shared execution boundary

Shopify and Stripe are registered in the provider-neutral Marketing run service, but Marketing-tab-created sources continue to be provisioned with:
- `status: ready`;
- `syncMode: manual`;
- `sourceConfig.liveProviderExecution: false`.

The execution-authorisation check occurs before provider dispatch. No real Shopify or Stripe request is made by merging this source code.

## Not activated

- no live Shopify or Stripe credentials are used;
- no production provider request;
- no historical backfill;
- no scheduler/worker activation;
- no Shopify mutations;
- no Stripe charge/refund/payment mutations;
- no production deployment.
