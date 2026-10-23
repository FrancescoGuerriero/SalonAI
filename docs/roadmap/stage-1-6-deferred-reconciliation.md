# Stage 1–6 deferred-development reconciliation

Date: 2026-10-23
Authority: AIIBP Roadmap v3.0 and the retained stage-specific deferred implementation records.

This record prevents previously deferred work from being lost or rebuilt. It separates application-source completion from provider acceptance, production data mutation and deployment operations.

## Hard sequencing rule

Stage 7 must not begin until the Stage 1–5 deferred-source audit is reconciled and Stage 6 source implementation passes its CI/security gates. Provider credentials, live acceptance, production backfills, deployment and later-stage roadmap capabilities are not to be disguised as missing source code.

## Stages 1–2 reconciliation

Current `main` was re-audited before entering Stage 6. No legitimate Stage 1 or Stage 2 application-source backlog remains that should be pulled forward ahead of Stage 6.

Additional regression-safe foundations were added during the reconciliation pass without creating parallel state machines:

- canonical queue lifecycle event schemas;
- `queue.visit_created` emission from canonical front-desk QueueVisit creation;
- canonical customer check-in status event evidence;
- regression coverage for the kiosk/front-desk event contract.

Mature shared-device kiosk/device-management work remains a later roadmap concern and is not a Stage-6 prerequisite.

## Stage 3 reconciliation

Source-complete before Stage 6:

- payment-link conversion rate;
- membership collection failure rate;
- membership collection recovery rate;
- durable, idempotent membership recovery cases over the canonical collection-attempt state.

These use the canonical Stage-5 metric catalogue and existing MembershipContract/CollectionAttempt financial authority. They do not create a second billing executor or Stage-7 customer journey.

Still activation/operations-gated rather than missing source code:

- Outlook production OAuth acceptance;
- SendGrid live acceptance/provider-plan activation;
- live recurring-membership provider subscription acceptance;
- production invoice backfill/materialisation;
- production release/deployment.

Still owned by later roadmap stages:

- Stage 7 recurring-billing recovery messaging/workflows;
- Stage 11 card-present/terminal commerce.

## Stage 4 reconciliation

The previously deferred external review/listing connector re-entry has now been absorbed into Stage 6 rather than implemented as a competing Stage-4 subsystem.

Source-complete contracts now include:

- tenant-owned external reviews with provider/external IDs, provider payload digest and source provenance;
- idempotent external-review upsert/synchronisation contract;
- tenant-owned business-listing snapshots with provider/location provenance;
- explicit customer/profile linkage with tenant verification and no automatic identity inference;
- human-governed external response lifecycle (`draft` -> `approved`) with provider publication explicitly gated;
- combined internal/external reputation hub and rating summaries;
- tenant proof before internal review moderation or response mutation.

Still activation/operations-gated:

- authorised provider credentials/connections;
- provider-specific production acceptance;
- live external-review response publication;
- production synchronization/backfill.

Mature kiosk/shared-device deployment remains later-stage work.

## Stage 5 reconciliation

Source-complete before Stage 6:

- canonical Marketing Data Core, raw/normalised lineage, field mapping and sync contracts;
- commerce metric catalogue additions required by the Stage-3 deferred measurement definitions;
- governed provider credential resolution;
- provider-specific external marketing adapters and retry/pagination execution contracts;
- run/status projection and inactive-by-default worker orchestration.

Still activation/operations-gated:

- live GA4, Google Search Console and Bing Webmaster credentials/connections;
- production worker activation and quota tuning;
- production historical backfill;
- recurring production SEO crawling;
- production credential rotation/signing-secret operations;
- release/deployment.

## Stage 6 implementation status

Stage 6 — Cross-channel campaigns, social & attribution — is source-implemented across the roadmap's six core contracts:

1. one tenant-owned master Campaign -> multiple governed provider executions;
2. campaign IDs/keys and UTM metadata;
3. append-only deterministic attribution across Lead, Opportunity, Customer and conversion lifecycle;
4. governed social-publication records/adapters for Facebook, Instagram, LinkedIn and Google Business Profile, with live execution disabled by default;
5. unified internal/external reputation and listing provenance hub with explicit profile linkage and human approval;
6. calculated campaign fields and deterministic blended provider data with a non-double-counting source policy.

### Stage 6 activation gates

The following are intentionally not performed by source completion:

- live social-provider publishing (`SOCIAL_PUBLISHING_LIVE_ENABLED` remains an explicit activation gate);
- automatic social worker activation (`SOCIAL_PUBLISHING_WORKER_ENABLED` defaults off);
- credential provisioning or OAuth/provider account connection;
- external-review provider response publication;
- historical production backfill;
- production migration or deployment.

## Validation gate before Stage 7

Do not mark Stage 6 accepted or start Stage 7 until the latest `main` head has:

1. Fast CI green;
2. CodeQL/security green;
3. Point-6 campaign/attribution/social/reputation/blended-data regression tests green;
4. no unresolved tenancy or production-activation regression;
5. no production provider call, migration, backfill or deployment performed as part of source validation.
