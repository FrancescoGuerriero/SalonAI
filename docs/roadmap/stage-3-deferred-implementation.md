# Stage 3 deferred implementation and activation record

This file records Stage 3 work that is intentionally **not** implemented or activated in the current code change so it is not lost, duplicated or pulled forward incorrectly later.

Authority: AIIBP Roadmap v3.0, Stage 3 — Communications, calendars & commerce.

## Implemented / already present

The repository contains the following Stage 3 foundations and they must be reused rather than rebuilt:

- governed Twilio SMS/WhatsApp delivery, signed webhook handling, WhatsApp booking/consultation and customer communication preferences;
- SendGrid transactional/marketing readiness, signed Event Webhook handling, suppression/consent controls, controlled marketing-acceptance safeguards and production provider configuration support;
- scheduler/reminder/retry controls;
- customer add-to-calendar support;
- Google Calendar and Microsoft Outlook shared calendar connector architecture, OAuth storage, mapping, outbox/retry, webhook and reconciliation services;
- Stripe Checkout, appointment deposits/balances, order payments, webhook idempotency, refunds and payment reconciliation;
- canonical membership contracts, benefit wallets, immutable stored-value ledger evidence and cross-location liability/settlement foundations;
- deterministic recurring-membership collection retry policy and collection-attempt evidence;
- Stripe recurring-membership invoice reconciliation added by this Stage 3 completion: `invoice.payment_succeeded` / `invoice.payment_failed` reconcile into canonical `Payment`, `CollectionAttempt`, membership status/next collection, retry state and successful benefit refresh without creating a competing billing scheduler;
- canonical invoice lifecycle for appointments/orders, including automatic settlement/refund reconciliation and mixed-cart-safe parent-payment accounting;
- provider-neutral payment-request/Text2Pay abstraction reusing the existing `Payment` + Stripe Checkout + transactional communication path.

## Deferred / skipped for later

### 1. Microsoft Outlook production activation

**Status:** application code exists; production provider activation is not configured.

Do later only when Microsoft OAuth credentials and an approved staff connection are available:

1. configure the Microsoft Calendar OAuth application/redirect URI in the protected production environment;
2. connect an approved staff account;
3. run the existing read-only calendar readiness gate;
4. run the guarded provider CRUD/webhook acceptance;
5. run the worker/end-to-end SalonAI Appointment synchronization acceptance used for Google;
6. retain sanitized evidence and close the provider activation gate.

Do **not** build a second Outlook calendar implementation.

### 2. SendGrid live acceptance / provider-plan activation

**Status:** application readiness and guarded transactional/marketing acceptance code exist; the previous controlled transactional acceptance was blocked by provider account credits/plan state.

Do later only after SendGrid Email API sending capability is reactivated:

1. verify the production SendGrid account has an active sending plan/credits;
2. rerun the existing production SendGrid readiness workflow;
3. require `readyForAcceptance: true` with live provider connectivity;
4. perform one controlled transactional acceptance send to the approved destination;
5. verify the signed delivered-event reconciliation;
6. run the existing controlled marketing acceptance only after consent/suppression checks pass;
7. keep live marketing disabled until the controlled acceptance evidence is complete.

Do **not** change the application transport merely to work around an inactive provider account.

### 3. Live recurring-membership provider activation / acceptance

**Status:** application reconciliation is implemented. No production subscription is created or mutated by this change.

When recurring memberships are deliberately activated in production:

1. create/link the provider-side recurring subscription using an approved PCI-external provider flow;
2. persist only the provider and opaque `paymentProviderSubscriptionId` on the canonical `MembershipContract`;
3. configure Stripe to send `invoice.payment_succeeded` and `invoice.payment_failed` to the existing signed Stripe webhook endpoint;
4. run a guarded success/failure acceptance against an approved test membership;
5. verify canonical `Payment`, `CollectionAttempt`, contract collection status, deterministic retry state and benefit refresh/reconciliation;
6. verify webhook replay does not duplicate collection attempts or benefits;
7. retain sanitized evidence before declaring recurring membership billing production-accepted.

SalonAI must not store PAN/CVV/raw card credentials and must not introduce a second recurring-charge executor alongside the provider subscription lifecycle.

### 4. Recurring-billing failure customer journeys

**Status:** intentionally deferred because the v3 roadmap schedules recurring-billing failure journeys under Stage 7 CRM/retention & workflow automation, not Stage 3.

Stage 3 owns the financial state transition (`past_due`, failure evidence and deterministic retry scheduling). Stage 7 may later add governed customer journeys, escalation, recovery messaging and workflow outcomes over that canonical state. Do not add a parallel retry/payment state machine in Stage 7.

### 5. Production invoice materialisation/backfill

**Status:** not required for the application contract and intentionally not performed.

Invoices are created/reconciled from canonical Appointment/Order + Payment state. Existing historical records can be materialised lazily when requested. A production-wide backfill would be a data mutation and must be separately approved, dry-run, counted, backed up and rollback-planned before execution.

### 6. Production release/deployment of the Stage 3 completion

**Status:** source implementation only until PR/CI/security gates complete.

Required release sequence:

1. PR validation and review;
2. Fast CI, CodeQL/security and relevant backend/frontend regression gates green;
3. merge to `main` only after gates pass;
4. immutable release/tag and release evidence;
5. manually authorised production deployment;
6. production P0/smoke verification;
7. no database migration/backfill unless explicitly approved.

### 7. Card-present / terminal commerce

**Status:** intentionally not part of Stage 3.

Card-present terminal/merchant mapping, capture/void/receipt and physical payment expansion remain a later roadmap concern (Stage 11). Stage 3 continues to use provider-hosted/tokenised online payment flows and must not store PAN/CVV/raw card data.

### 8. Payment-link and membership business metrics

**Status:** measurement definitions belong to the versioned metric catalogue / later measurement stage.

The Stage 3 domains now emit canonical payment and membership evidence needed for later metrics such as payment-link conversion and membership collection failure/recovery. Do not pull Stage 5 metric-catalogue implementation back into Stage 3.

## Re-entry rule

Before implementing any item above, first confirm that its roadmap stage/dependency is active and that the missing work is still genuinely absent from current `main`. Provider/configuration blockers must not be converted into duplicate application code.