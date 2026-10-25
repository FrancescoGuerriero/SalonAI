# Stage 7 — CRM, retention and marketing automation implementation record

Date: 2026-10-25  
Authority: AIIBP Master Development Roadmap v2.9, Stage 7.  
DEV owner: DEV1.

## Status

**Source/UI status: complete for Point 7.**  
**Production activation status: intentionally gated.**

Stage 7 now implements the roadmap CRM, lifecycle, segmentation, consent-aware journey and campaign-to-revenue requirements without reopening Stages 1–6 or creating competing sources of truth.

## Scope implemented

1. **Customer 360 v2** — deterministic, business-scoped read projection over canonical Customer data plus appointment/service/stylist history, consultation history, communication history, loyalty evidence, gift-card wallet history, reviews, consent evidence, Stage-6 attribution touches and Stage-7 retention-enrolment evidence.
2. **Lifecycle states** — deterministic classification for prospect, new customer, active, repeat, loyal/VIP-equivalent, at-risk/lapsing, lapsed/dormant and reactivated/recovered states.
3. **CRM segmentation** — deterministic segments for value, visit behaviour, membership, rebooking, cancellation/no-show history and channel contactability. Latest ConsentRecord evidence is preferred where available, with compatibility fallback for older customer records.
4. **Customer intelligence signals** — fresh existing AiPrediction records are exposed as advisory evidence for churn risk, recommended campaign/channel and service recommendation. A deterministic next-best-action summary is produced for management review only; `executionAuthorised` remains false.
5. **Consent-aware journeys** — RetentionJourney is business-owned; routes require trusted tenant context; preview audiences are scoped to the active business and communication readiness remains consent-aware.
6. **Journey enrolment/outcome ledger** — idempotent, auditable RetentionJourneyEnrollment records separate journey definition from customer enrolment, step evidence and business outcomes.
7. **Recurring-membership recovery journeys** — Stage 7 recognises membership payment failed/recovered triggers and recovery stop/outcome state. A governed reconciliation bridge consumes canonical MembershipRecoveryCase records and creates or resolves Stage-7 journey enrolment evidence idempotently, while leaving payment collection/retry execution with the canonical Stage-3 finance domain.
8. **Campaign-to-revenue measurement** — Stage-7 journey outcomes are joined at the reporting layer to canonical Stage-6 CampaignExecution spend/revenue/conversion facts. No replacement attribution engine is introduced.
9. **Management workspace** — the Retention Automation route now exposes lifecycle/segment inspection, Customer 360 review, retention enrolment evidence, campaign-to-retention measurement, membership-recovery reconciliation and governed recovery-journey template controls while preserving the existing journey builder.
10. **Frontend API contract** — management frontend services consume Customer 360, CRM segments, enrolments/outcomes, membership-recovery reconciliation and campaign-retention measurement through the existing retention-automation surface.

## HCI and operator-safety evidence

- The existing journey builder is preserved rather than replaced, reducing relearning and regression risk.
- Stage-7 operational information is grouped above the journey builder as a separate evidence workspace.
- Destructive/irreversible actions are absent from the Stage-7 workspace.
- Recovery reconciliation and journey enabling explicitly state that live sending remains disabled.
- Tables have textual headings and status labels; asynchronous actions expose loading/disabled states.
- Success/error messages use status/alert semantics.
- The dedicated Point 7 gate builds the production frontend and enforces the existing bundle budget.

## Safety and tenancy rules

- Every new Stage-7 management route requires authenticated permission checks plus trusted Business tenant context.
- RetentionJourney and RetentionJourneyEnrollment are Business-owned.
- Customer, campaign and journey identifiers are verified against the active Business before use.
- Customer-inactive preview aggregation explicitly constrains the Customer audience to the active Business.
- Customer 360 appointment and communication histories are business-scoped.
- Journey execution remains `executionAuthorised: false`; no provider send is activated by this source implementation.
- The membership-recovery bridge consumes MembershipRecoveryCase evidence only; it does not mutate CollectionAttempt, MembershipContract or Payment state.
- Stage 7 does not charge a card, retry a collection, create a PaymentIntent or mutate canonical membership financial state.
- Stage-6 attribution and campaign execution remain the marketing source of truth.
- AI outputs are advisory evidence only and do not become CRM authority or autonomous actions.

## Production/activation gates intentionally not performed

The following remain controlled operational/release work rather than missing Point-7 source code:

- legacy Customer/RetentionJourney Business-provenance readiness assessment and any approved production backfill;
- provider credentials or live marketing delivery activation;
- worker/scheduler activation for autonomous journey execution;
- production data migration;
- historical journey-enrolment reconstruction;
- production release/deployment and production smoke verification.

Existing legacy records without canonical Business ownership must fail closed on the Stage-7 tenant-scoped management surface until an explicit, reviewed migration/backfill is authorised.

## Validation

The dedicated `Point 7 CRM Retention Gate` validates Stage-7 CRM contracts, membership-recovery bridge contracts, existing retention automation contracts, backend application imports, production frontend build and frontend bundle budget. Fast CI and CodeQL remain required merge evidence. The repository-wide Stage 1–6 regression gate remains separate so older baseline failures are not silently rewritten as part of Point 7.

No production migration, backfill, deployment, provider call or live retention execution is part of this source-completion record.
