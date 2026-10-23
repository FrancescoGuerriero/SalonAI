# Stage 4 deferred implementation and acceptance record

Authority: AIIBP Roadmap v3.0, Stage 4 — Customer experience, CMS & reputation, including retained v2.9 Content Studio requirements.

This file records work intentionally not pulled into the Stage 4 source-completion change.

## Implemented / already present

- customer self-service account, appointment-change requests, favourites, loyalty, wallet, inbox, consent/preferences and verified visit reviews;
- end-to-end abandoned booking intent persistence, inactivity detection, signed recovery links, consent classification, recovery attribution and `booking.abandoned` / `booking.recovered` events;
- Stage 4 abandonment measurement summary for abandoned/resumed/converted journeys;
- governed Reputation Hub over verified visit reviews with human-controlled review publication and salon responses;
- structured Content Studio with draft/version snapshots, preview, explicit publish/archive, multilingual-ready locale content, SEO metadata and responsive-media metadata/alt text requirements;
- authenticated customer check-in prototype that changes the canonical Appointment to `checked_in` instead of creating a kiosk-specific booking record;
- explicit customer relationship/household model with invite/accept/decline/revoke states and all private-data sharing disabled by default.

## Deferred / skipped for later

### 1. Representative-customer usability and accessibility acceptance

**Status:** source implementation can be automated and inspected, but the roadmap's representative-customer task-success evidence cannot be fabricated.

Later acceptance should test priority desktop and mobile journeys with representative users, recording task success, errors, completion time and accessibility findings. Automated CI/accessibility checks supplement but do not replace this evidence.

### 2. Mature anonymous/shared-device kiosk and PWA operation — Stage 11

**Status:** Stage 4 implements the signed-in customer check-in prototype only.

Later Stage 11 work may add controlled QR/short-code identity, shared-device session expiry, kiosk reset/privacy behaviour, offline/PWA handling, device management, accessibility/hardware acceptance and production front-desk deployment. Do not create a second appointment/queue state machine; all kiosk actions must continue to use canonical Appointment/QueueVisit state.

### 3. External review/listing connectors — Stage 6

**Status:** Reputation Hub currently governs first-party verified SalonAI reviews.

Later integration work may ingest/provider-link Google or other approved review/listing sources through the integration platform with external IDs, idempotent sync, provenance, guest/profile linkage and human response approval. Do not scrape or duplicate first-party review authority.

### 4. AI review drafting and AI sentiment — Stage 8

**Status:** deliberately not pulled forward.

AI-generated response drafts or sentiment/topic classification may be added only through the governed AI layer with provenance, confidence, human approval and audit evidence. Stage 4 keeps moderation and response publication deterministic and human controlled.

### 5. Provider-specific media upload/transcoding/CDN pipeline

**Status:** Content Studio implements the canonical structured media contract (URL, dimensions, responsive variants and required alt text) without selecting a binary-media provider.

If a managed media provider is later approved, add upload, virus/type checks, resizing/transcoding, responsive variants, storage lifecycle and CDN delivery behind this contract. Do not couple ContentPage records to a vendor-specific schema.

### 6. Household financial/appointment sharing policy

**Status:** relationship records are implemented; sharing is fail-closed.

Actual cross-customer appointment management, loyalty pooling, wallet/gift-card access or communication delegation must remain disabled until a later privacy/product policy explicitly defines consent, revocation, minors/dependants, audit and authorisation rules.

### 7. Production data materialisation/backfill

**Status:** no production mutation is required for source completion and none is performed here.

If historical content, review responses, relationships or tenant ownership require production backfill, handle that as a separately approved migration with dry-run counts, backup, verification and rollback evidence.

### 8. Production release/deployment of Stage 4

**Status:** source implementation only until PR, CI and security gates complete.

Required later sequence: green PR Fast CI and CodeQL → merge to `main` → post-merge checks → immutable release/tag evidence → explicitly authorised production deployment → production smoke/P0 verification.

## Re-entry rule

Before implementing any deferred item, confirm its roadmap stage/dependency and audit current `main` first. Later work must extend these canonical domains rather than creating parallel CMS, review, kiosk, booking or household authorities.
