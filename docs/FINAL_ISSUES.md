# SalonAI Final Issues Register

_Last reviewed: 21 September 2026_

This file is the canonical forward-looking issue register for SalonAI. It replaces the long-running GitHub issue threads #117, #118 and #133 as the active source of truth. Those issues remain historical evidence only after closure.

## Current baselines

- Production release: `v8.15.5`
- Production commit: `a8123c0bbf84e33941a70b479b16d2be60fb31ae`
- Production deployment run: `35530130097` (successful, including smoke test and deployment evidence).
- Production P0 read-only verification run: `35583727762`; evidence artifact: `salonai-production-p0-verification-35583727762`.
- Repository `main` contains the governed P0 verification workflow merged in PR #211 and is therefore ahead of the deployed application image until the next immutable release.
- At the completion of the PR closeout audit, no pre-existing pull requests remained open.
- Developer 3 has no open PR. The latest workforce/profile/media recovery work was merged in PR #208 and released in `v8.15.4`.

## P0 — Production data-state and acceptance verification

### 1. Governed Super Admin account verification — COMPLETE

Production verification run `35583727762` executed the promotion tool in dry-run mode through the protected production SSH trust path.

Evidence:

- exactly two requested accounts were resolved: `Francesco` and `Francesco Guerriero`;
- both accounts are active;
- both already have role `super_admin`;
- both reported `changeRequired: false`;
- `selectedAccounts: 2`;
- no database write was requested or required.

Because production was already in the intended state, applying the promotion would have been an unnecessary write.

### 2. Service state migration and production verification — DATA STATE COMPLETE / ENFORCEMENT FIX IN PROGRESS

Production verification run `35583727762` executed the service-state migration in dry-run mode and returned `candidates: 0`. Production therefore has no remaining legacy service-state records requiring migration, so no migration write is needed.

During the final cross-channel acceptance review on 21 September 2026, Developer 1 identified a separate enforcement defect: customer booking uses canonical `service.bookable`, but staff-managed booking did not yet reject `bookable=false`, and the WhatsApp bot still preferred legacy `onlineBookable`. This must be corrected and released before this item is fully closed.

Remaining completion evidence:

- release the canonical global-bookability enforcement fix;
- rerun the governed production P0 verification against the repaired release;
- verify the finalized roster and live workforce reconciliation;
- verify `active=false`, `published=false` and `bookable=false` each have their intended independent effect;
- verify `bookable=false` blocks standard booking, managed/staff booking and WhatsApp booking while not implicitly deleting or unpublishing the service.

### 3. Final production RBAC/workforce acceptance — IN PROGRESS

PR #211 added the governed production P0 verification path. The first run succeeded for release identity, Super Admin state and service migration state. The next verification revision adds finalized-roster verification, live workforce reconciliation and deployed-container RBAC/bookability regression checks.

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
