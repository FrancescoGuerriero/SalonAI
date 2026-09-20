# SalonAI Final Issues Register

_Last reviewed: 20 September 2026_

This file is the canonical forward-looking issue register for SalonAI. It replaces the long-running GitHub issue threads #117, #118 and #133 as the active source of truth. Those issues remain historical evidence only after closure.

## Current baselines

- Production release: `v8.15.4`
- Production commit: `37c1e657a8eeada3f62b13f14cd01b86828e32ad`
- Current main after dependency-maintenance integration: `f520ca55b978ebda8e36735a233977e7d6589e2e`
- Current main is ahead of production by the maintenance work merged in PR #209.
- Open pull requests after the maintenance closeout: none.
- Developer 3 has no open PR. The latest workforce/profile/media recovery work was merged in PR #208 and released in `v8.15.4`.

## P0 — Production data-state and acceptance verification

### 1. Governed Super Admin account verification

The application-side controls for governed multi-account Super Admin promotion are merged, but the production MongoDB result must not be assumed from CI.

Required completion evidence:

- run the production promotion tool in dry-run mode against the two requested administrator accounts;
- review the exact matched accounts before applying;
- apply only with the explicit production confirmation required by the script;
- run verification after apply;
- confirm both intended accounts have the expected Super Admin authority;
- confirm no unintended account was promoted.

Do not mark this item complete from source code, CI, or deployment success alone.

### 2. Service state migration and production verification

SalonAI now treats service `active`, `published` and `bookable` as separate concepts. Legacy compatibility exists, but the governed production data migration still requires explicit operational verification if it has not already been applied.

Required completion evidence:

- run the service-state migration in dry-run mode;
- inspect the proposed legacy-to-canonical mapping;
- apply only after the dry-run is accepted;
- verify representative services after migration;
- verify `active=false`, `published=false` and `bookable=false` each have their intended independent effect;
- verify `bookable=false` blocks standard booking, managed/staff booking and WhatsApp booking while not implicitly deleting or unpublishing the service.

### 3. Final production RBAC/workforce acceptance

The code and automated gates are complete, but live role/state verification should remain explicit.

Verify in production:

- Super Admin and Administrator can see the intended complete management areas;
- Manager, Receptionist, Stylist/Salon Staff and custom roles see only delegated workspaces;
- direct URLs and backend APIs enforce the same permissions as the navigation;
- all genuine employees/staff profiles are visible to management, including profile-only records without fabricated login authority;
- employee `isActive`, `acceptsAppointments` and `profilePublished` remain independent;
- global Not Bookable behavior is enforced consistently;
- employee/service management changes remain auditable.

## P0 — SendGrid transactional email production acceptance

Application support, readiness tooling and domain authentication work are present, but signed production acceptance is not complete until the deferred provider setup is finished.

Remaining work:

- regain SendGrid account access;
- configure the signed SendGrid Event Webhook for `/api/message-delivery/webhooks/sendgrid/events`;
- install the public verification key and required production environment values;
- keep `SENDGRID_EVENT_WEBHOOK_ENABLED` disabled until signature verification is configured;
- run `npm run sendgrid:readiness`;
- run one deliberate `npm run sendgrid:acceptance` transactional test;
- verify the signed delivered-event is reconciled by SalonAI;
- treat marketing-email activation as a separate acceptance step.

Existing Twilio SMS, WhatsApp, WhatsApp bot and WhatsApp booking behavior must not be redesigned as part of this work unless a real regression is found.

## P1 — CRM retention execution safety

The retention journey management, audience dry-run and contact-readiness evidence are implemented. Automatic customer delivery remains intentionally disabled.

Next bounded increment:

- add idempotency evidence/checking for journey execution;
- evaluate step stop conditions using canonical data:
  - `appointment_booked`
  - `purchase_completed`
  - `customer_opted_out`
  - `none`
- add proposed scheduling/audit evidence per candidate and step;
- expose journey/step identity, evaluation timestamp and proposed idempotency key;
- fail closed when consent, suppression, stop-condition or idempotency evidence is ambiguous;
- keep `executionAuthorised: false` until the complete safety gate is reviewed;
- do not create provider sends merely because a preview candidate is contact-ready.

Only after the safety gate is complete should controlled scheduling through the existing `ScheduledCommunication` architecture be considered.

## P1 — AI-first platform continuation

The bounded AI checkpoint through the governed Adviser, inference/outcome linkage, calibration and drift evidence is complete. Future AI work should support the active product roadmap rather than run as an isolated parallel programme.

Remaining high-value AI work:

- run the governed no-show dataset dry-run against authorised historical data;
- inspect split sizes, class balance, leakage/data-quality evidence and label coverage;
- freeze a training dataset only when the evidence is sufficient;
- run the baseline/model experiment and compare against the existing deterministic rules;
- do not promote a trained model until frozen-test-set evaluation and lifecycle review justify it;
- continue contextual `Ask SalonAI` capabilities where they materially support appointments, CRM, inventory, services, communications and management workflows;
- preserve permission, evidence, confidence, model-version and human-confirmation boundaries;
- no automatic retraining, model promotion or mutating Adviser actions without an explicit governed design.

## P2 — Catalogue media architecture

The `v8.15.4` catalogue image implementation is bounded and validated, but local uploads are currently stored as optimised base64 image data in catalogue documents.

For the resale/SaaS architecture, migrate catalogue media to managed object/image storage so MongoDB stores URLs and metadata rather than image payloads.

Target design:

- authenticated upload endpoint;
- type/size validation and image optimisation;
- object storage or image CDN;
- stable HTTPS asset URL;
- metadata/ownership/audit fields in MongoDB;
- safe deletion/replacement lifecycle;
- migration path for existing embedded catalogue images.

This is an architectural improvement, not a blocker for the current production release.

## P2 — Deferred Vitest 5 toolchain upgrade

Dependabot PRs #206 and #207 were intentionally closed rather than force-merged.

Reason:

- `vitest@5.0.1` and `@vitest/coverage-v8@5.0.1` must be upgraded together;
- separate upgrades create an npm peer-dependency `ERESOLVE`;
- Vitest 5 requires Node >=22.12;
- SalonAI currently declares Node 20.19 support.

Revisit only when the project intentionally raises its supported Node baseline. At that point:

- update both Vitest packages together;
- update the declared Node engine deliberately;
- regenerate the lockfile;
- run legacy tests, component tests, coverage, production build, Playwright/accessibility, CI, CodeQL and security gates.

## Resolved and archived context

The following work is considered integrated and should not be reopened as a competing implementation:

- Developer 3 dashboard/RBAC/bookability reconciliation;
- Developer 3 complete workforce and profile-only staff recovery;
- service/product catalogue image editing introduced in PR #208;
- Developer 2 mobile/UI/accessibility corrective work already integrated;
- the three-lane ownership model: Developer 1 implements/integrates/releases, Developer 2 audits quality/UI/accessibility, Developer 3 audits management/dashboard completeness;
- provider-neutral integration-platform foundation from PR #119;
- the bounded AI checkpoint through PR #185;
- dependency maintenance from PR #209:
  - Docker build-push action 7.4.0;
  - Nodemailer 10.0.10;
  - approved frontend minor/patch lockfile refresh.

Old Developer 3 branches that are behind or diverged from current `main` are historical work branches. They must not be merged wholesale into current `main`. Any genuinely useful behavior found there must first be revalidated against this register and reimplemented from current `main` if still missing.

## Operating rule for new findings

Do not create parallel long-running issue trackers for the same workstream.

For a new confirmed defect or missing requirement:

1. add it to this file in the appropriate priority section;
2. include reproduction/acceptance criteria and affected area;
3. implement from current `main` on an isolated branch;
4. validate through the required automated/security/browser/smoke gates;
5. merge through PR;
6. update this file in the same or immediately following PR when the item is completed.

Historical GitHub issues and old branch comments remain evidence, not the active backlog.
