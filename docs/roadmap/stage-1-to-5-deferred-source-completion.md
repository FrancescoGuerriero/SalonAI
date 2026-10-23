# Stages 1–5 deferred source-code completion record

Authority: AIIBP Roadmap v3.0 and the existing Stage 3, Stage 4 and Stage 5 deferred implementation records.

This record reconciles deferred **source-development** work before Stage 6. It does not authorise production deployment, live-provider activation, production migrations/backfills, irreversible production mutations or representative-user acceptance evidence.

## Stage 1 — Identity, permissions & configuration foundation

### Source status

No unresolved Stage-1 source-code dependency was identified that needed to be pulled forward before Stage 6. Canonical RBAC, effective authority, tenant-safe configuration and governed feature/config controls remain the authorities reused by later stages.

### Still approval/acceptance gated

- production identity-provider configuration changes;
- production role/permission materialisation where migration is required;
- production release/deployment;
- any representative administrator acceptance evidence that cannot be fabricated by source tests.

## Stage 2 — Core operations & omnichannel booking

### Source status

No new booking engine or queue domain was introduced. Stage-6 work continues to link growth evidence to canonical Appointment records rather than creating a second booking lifecycle.

### Still approval/acceptance gated

- production booking/queue data migration or historical materialisation;
- production channel/provider credentials;
- production release/deployment;
- physical/shared-device kiosk acceptance that belongs to the later kiosk stage.

## Stage 3 — Communications, calendars & commerce

### Deferred source item now completed

The payment-link and membership collection measurements that were deferred to the Stage-5 metric catalogue are now canonical metric definitions:

- `payment-link-conversion-rate`;
- `membership-collection-failure-rate`;
- `membership-collection-recovery-rate`.

The definitions are evidence-based and use the existing Payment, CollectionAttempt and MembershipContract authorities. They do not create a second payment or membership ledger.

### Still correctly deferred

- live Outlook/calendar provider activation and acceptance;
- live SendGrid/Twilio/provider acceptance where account credentials or external delivery are required;
- live recurring-membership provider activation;
- advanced recurring-billing failure workflow automation that belongs to Stage 7;
- production invoice/payment/membership backfills;
- card-present/hardware acceptance that belongs to Stage 11;
- production release/deployment.

## Stage 4 — Customer experience, CMS & reputation

### Deferred source item moved into Stage 6

External review/listing integration is implemented as a Stage-6 Integration Platform capability rather than modifying first-party Reputation Hub authority. External provider reviews are provenance records with provider IDs and sync hashes. External review replies require explicit human approval before any provider write.

### Still correctly deferred

- representative-customer usability/accessibility acceptance;
- mature anonymous/shared-device kiosk/PWA operation (Stage 11);
- AI review drafting/sentiment (Stage 8);
- provider-specific binary media/transcoding/CDN selection;
- household financial/appointment sharing policy and authorisation;
- production data backfill/materialisation;
- production release/deployment.

## Stage 5 — SEO, measurement & integration core

### Deferred source items now completed

The Marketing Data Core now includes source-level provider execution infrastructure in addition to the previously completed contracts:

- governed encrypted provider credential types and explicit IntegrationConnection credential bindings;
- GA4 execution adapter with OAuth refresh, bounded pagination, timeout and retry/backoff;
- Google Search Console execution adapter with OAuth refresh, bounded pagination and checkpointing;
- Bing Webmaster execution adapter with governed credential resolution;
- explicit provider-run endpoint separated from sample/manual ingestion;
- inactive-by-default Marketing Data sync worker with bounded source count/concurrency, due-source selection and graceful status/stop controls;
- provider execution continues to write through the canonical raw → normalised lineage and reconciliation pipeline;
- Stage-3 commerce metrics are incorporated in the same canonical metric catalogue.

The worker is disabled by default (`MARKETING_DATA_SYNC_WORKER_ENABLED=false`) and is not an implicit production activation mechanism.

### Still correctly deferred

- real GA4/Search Console/Bing account authorisation and consent;
- production OAuth/provider secrets;
- production worker activation and capacity/quotas approval;
- production historical marketing backfill;
- recurring production SEO crawling and egress/robots policy acceptance;
- production credential rotation/provider-side coordination;
- production webhook signing-secret provisioning/rotation;
- production release/deployment.

## Re-entry rule

Later activation must use the canonical authorities already implemented: RBAC/effective authority, Appointment/QueueVisit, Payment/MembershipContract/CollectionAttempt, first-party Reputation Hub, IntegrationApp/IntegrationConnection/CredentialVersion, Marketing Data Core, event catalogue and canonical metric catalogue. Do not introduce parallel identity, booking, payment, review, secret, event, connector or metric frameworks.
