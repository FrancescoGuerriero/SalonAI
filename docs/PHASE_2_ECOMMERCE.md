# Phase 2 — E-commerce

## Status

Phase 2 is implemented as a complete vertical slice across the Express API, MongoDB models and React frontend.

### Customer features

- Public product catalogue with search, categories and sorting
- Persistent browser cart
- Quantity and stock-limit handling
- Authenticated checkout
- Salon collection or UK delivery
- Server-calculated prices, delivery fees and totals
- Stripe-hosted Checkout support
- Safe console/demo payment mode for local development
- Payment-success status page
- Customer order history and pending-order cancellation

### Management features

- Product creation and editing
- Active/featured catalogue controls
- Inventory summary and retail stock valuation
- Reorder levels and low-stock reporting
- Audited stock receipts and removals
- Product-order queue and fulfilment status updates
- Protected management endpoints

### Reliability and security

- Product prices are loaded from MongoDB during checkout; client totals are ignored.
- Inactive products and cost prices are excluded from the public catalogue.
- Stock is committed only after payment confirmation.
- Stock commitment is idempotent and includes compensating rollback if an item becomes unavailable.
- Stripe webhook signatures are verified against the original raw request body.
- Demo payment confirmation is disabled in production.
- Customer order reads are restricted to the authenticated account.
- Product, inventory and all-order operations require a management role.

## Local demo mode

The default environment template uses:

```dotenv
PAYMENT_PROVIDER_MODE=console
```

Checkout creates an order and displays a **Confirm demo payment** action. No card is charged. Confirmation marks the payment as paid and commits stock movements.

Seed the demonstration catalogue after MongoDB is running:

```powershell
npm --prefix backend run seed:commerce
```

## Stripe test mode

Set the following values in `backend/.env`:

```dotenv
PAYMENT_PROVIDER_MODE=stripe
STRIPE_SECRET_KEY=sk_test_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me
FRONTEND_URL=http://localhost:5173
```

Configure Stripe to send events to:

```text
POST http://localhost:5000/api/commerce/webhooks/stripe
```

The implementation currently handles:

- `checkout.session.completed`
- `checkout.session.expired`

Stripe Checkout is hosted by Stripe, so the React application does not store or process card details.

## Main routes

### Public

- `GET /api/commerce/products`
- `GET /api/commerce/products/:identifier`

### Authenticated customers

- `POST /api/commerce/checkout`
- `POST /api/commerce/checkout/:id/confirm-demo`
- `GET /api/commerce/orders/mine`
- `GET /api/commerce/orders/:id`
- `POST /api/commerce/orders/:id/cancel`

### Management

- `GET /api/commerce/inventory/products`
- `GET /api/commerce/inventory/summary`
- `POST /api/commerce/products`
- `PATCH /api/commerce/products/:id`
- `POST /api/commerce/products/:id/stock-adjustments`
- `GET /api/commerce/products/:id/stock-adjustments`
- `GET /api/commerce/orders`
- `PATCH /api/commerce/orders/:id/status`

## Frontend routes

- `/shop`
- `/cart`
- `/checkout`
- `/checkout/success`
- `/orders`
- `/manage/inventory`
- `/manage/orders`
