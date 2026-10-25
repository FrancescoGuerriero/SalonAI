# Stage 7 — CRM, retention and marketing automation implementation record

Date: 2026-10-25  
Authority: AIIBP Master Development Roadmap v2.9, Stage 7.  
DEV owner: DEV1.

## Scope implemented

Stage 7 now has source contracts for the roadmap requirements without reopening Stages 1–6:

1. **Customer 360** — deterministic, business-scoped read projection over canonical Customer data, Stage-6 attribution touches and retention-enrolment evidence. No second Customer source of truth is introduced.
2. **Lifecycle states** — deterministic classification for prospect, new customer, active, repeat, loyal, at-risk, lapsed and reactivated states.
3. **CRM segmentation** — deterministic segments for value, visit behaviour, membership, rebooking, cancellation/no-show history and channel contactability. Existing AI segmentation remains a later intelligence input rather than CRM authority.
4. **Consent-aware journeys** — RetentionJourney is business-owned; routes require trusted tenant context; preview audiences are scoped to the active business and communication readiness remains consent-aware.
5. **Journey enrolment/outcome ledger** — idempotent, auditable RetentionJourneyEnrollment records separate journey definition from customer enrolment, step evidence and business outcomes.
6. **Recurring-membership recovery journeys** — Stage 7 recognises membership payment failed/recovered triggers and recovery stop/outcome state. A governed reconciliation bridge consumes canonical MembershipRecoveryCase records and creates or resolves Stage-7 journey enrolment evidence idempotently, while leaving payment collection/retry execution with the canonical Stage-3 finance domain.
7. **Campaign-to-revenue measurement** — Stage-7 journey outcomes are joined at the reporting layer to canonical Stage-6 CampaignExecution spend/revenue/conversion facts. No replacement attribution engine is introduced.
8. **Frontend API contract** — management frontend services can consume Customer 360, CRM segments, enrolments/outcomes, membership-recovery reconciliation and campaign-retention measurement through the existing retention-automation surface.

## Safety and tenancy rules

- Every new Stage-7 management route requires authenticated permission checks plus trusted Business tenant context.
- RetentionJourney and RetentionJourneyEnrollment are Business-owned.
- Customer, campaign and journey identifiers are verified against the active Business before use.
- Customer-inactive preview aggregation explicitly constrains the Customer audience to the active Business.
- Journey execution remains `executionAuthorised: false`; no provider send is activated by this source implementation.
- The membership-recovery bridge consumes MembershipRecoveryCase evidence only; it does not mutate CollectionAttempt, MembershipContract or Payment state.
- Stage 7 does not charge a card, retry a collection, create a PaymentIntent or mutate canonical membership financial state.
- Stage-6 attribution and campaign execution remain the marketing source of truth.

## Production/activation gates intentionally not performed

The following remain operational activation work rather than missing Stage-7 source code:

- legacy Customer/RetentionJourney Business-provenance readiness assessment and any approved production backfill;
- provider credentials or live marketing delivery activation;
- worker/scheduler activation for autonomous journey execution;
- production data migration;
- historical journey enrolment reconstruction;
- production release/deployment and production smoke verification.

Existing legacy records without canonical Business ownership must fail closed on the Stage-7 tenant-scoped management surface until an explicit, reviewed migration/backfill is authorised.

## Validation

Stage 7 has a dedicated `Point 7 CRM Retention Gate` that runs the Stage-7 CRM, membership-recovery bridge and existing retention automation contract tests plus backend import verification. The complete backend suite is retained as diagnostic evidence; pre-existing failures outside the Stage-7 change set are not silently rewritten as part of this stage.

No production migration, backfill, deployment, provider call or live retention execution is part of this implementation record.
