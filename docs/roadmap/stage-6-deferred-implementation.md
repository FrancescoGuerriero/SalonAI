# Stage 6 deferred implementation and activation record

Authority: AIIBP Roadmap v3.0, Stage 6 — Cross-channel growth & lead conversion.

This record separates Stage-6 source completion from work that requires live provider accounts, production data, representative-user acceptance or later-stage capabilities.

## Implemented / already present

### Canonical lead and opportunity authority

- tenant-scoped Lead domain with source, score, status, ownership, nurture state and canonical Customer linkage;
- Opportunity domain and lead timeline events;
- immutable LeadScore snapshots;
- idempotent/deduplicated lead capture;
- identity-safe Lead → Customer conversion that searches canonical customer identity first, fails on ambiguous/unresolved/cross-business matches and uses a transaction;
- nurture primitives on the Lead authority without creating a second campaign/workflow engine.

### Completed for Stage 6

- cross-channel lead source normalisation for web, Google, Meta/social, WhatsApp, SMS, phone, email, referral, walk-in, import and API sources;
- preservation of UTM campaign/medium/term/content, landing/referrer and Google/Meta/Microsoft click IDs as acquisition evidence;
- scoped Integration API `lead:read` / `lead:write` endpoints that reuse canonical capture/deduplication;
- immutable GrowthAttribution evidence linking Lead → canonical Customer → Appointment;
- optional Opportunity linkage with service/customer consistency checks;
- conflict prevention when an Appointment already belongs to another lead attribution;
- post-conversion booking reconciliation for canonical customer appointments;
- payment-backed revenue evidence from canonical Payment records linked through attributed Appointments;
- channel/campaign attribution summaries with booking, paid-booking, booking→payment and net-revenue evidence;
- versioned `lead.booking_attributed@1` domain event;
- canonical Stage-6 metrics for lead→customer, lead→booking, booking→payment and attributed net revenue;
- management workspace at `/growth/leads` with lead pipeline, scores, sources, attribution/revenue evidence and connector visibility;
- versioned growth-channel connector catalogue for Google Business Profile, Meta social leads, Google Ads attribution and signed generic growth webhooks;
- Google Business Profile review ingestion with external IDs, idempotent upsert and provenance hashes;
- external review records kept separate from first-party SalonAI review authority;
- external Google review replies require explicit human approval before provider publication;
- current Google Business Profile review/reply endpoints are fixed provider endpoints, not administrator-supplied network targets.

## Deferred / skipped for later activation

### 1. Live Meta app/webhook activation

**Status:** social/source attribution and partner lead capture contracts are implemented; no Meta application, webhook subscription, app-review permission or production Page/Form is connected here.

Later activation requires an approved Meta application, webhook signature verification configuration, least-privilege permissions, provider app review where required, test lead evidence and production operations ownership.

### 2. Live Google Ads account activation / conversion upload

**Status:** Google click IDs and campaign attribution evidence are captured, and the connector contract explicitly models Google Ads attribution. No live Ads account is connected and no offline conversion is uploaded by this change.

Any future conversion upload requires approved Google Ads API access, account/customer selection, explicit product/legal approval and reconciliation against canonical booking/payment evidence.

### 3. Live Google Business Profile connection

**Status:** source code supports governed OAuth credentials, review ingestion and approved human replies. No Google Business Profile account/location is authorised or read/written by this change.

Later activation requires an approved Google Cloud project, Business Profile API access, verified location ownership, OAuth consent, least-privilege credential storage and a controlled read-only acceptance run before reply publication is enabled.

### 4. Automatic external review reply generation

**Status:** deliberately excluded. External responses are deterministic staff-authored drafts with explicit human approval.

AI-generated review drafts or sentiment/topic classification remain Stage 8 and must use the governed AI layer with provenance, confidence, audit and human approval.

### 5. Advanced nurture workflow automation

**Status:** Stage 6 retains lead nurture state/primitives and reuses existing communication/campaign authorities. It does not create a new workflow engine.

Advanced trigger/condition/action orchestration, retry trees and recurring-billing-style workflow infrastructure belong to Stage 7 unless the roadmap is explicitly revised.

### 6. Historical lead/attribution/review backfill

**Status:** no production history is materialised here.

Any production backfill requires dry-run counts, identity-conflict reporting, booking/payment reconciliation thresholds, provider-rate-limit review, backup and rollback evidence.

### 7. Production lead-source/provider webhook configuration

**Status:** integration scopes and API capture are implemented; production partner keys, webhook signing configuration, callback endpoints and provider secrets are not provisioned here.

### 8. Representative growth/reputation acceptance

**Status:** source and automated regression evidence cannot substitute for real operator/customer/provider acceptance.

Later acceptance should test lead capture/deduplication, staff pipeline usability, conversion conflict handling, booking attribution, revenue reconciliation, external review ingestion and human-approved replies using representative accounts and data.

### 9. Production release/deployment

**Status:** source implementation only until PR, Fast CI and CodeQL gates complete.

Required later sequence: green PR Fast CI + CodeQL → merge to `main` → post-merge checks → immutable release/tag evidence → explicitly authorised production deployment → provider/production smoke verification.

## Re-entry rule

Any later provider activation or growth automation must extend the canonical Lead/Opportunity/Timeline, Customer, Appointment, Payment, IntegrationApp/IntegrationConnection/CredentialVersion, first-party Reputation Hub, event catalogue and GrowthAttribution authorities. Do not create parallel lead identity, booking, payment, review, secret, event or attribution frameworks.
