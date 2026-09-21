# SalonAI Final Issues Register

_Last reviewed: 21 September 2026_

This file is the canonical forward-looking issue register for SalonAI. It replaces the long-running GitHub issue threads #117, #118 and #133 as the active source of truth. Those issues remain historical evidence only after closure.

## Current baselines

- Production release: `v8.15.6`
- Production application commit: `542e18b8f8f20234d942d9d25e5f01391500fe43`
- Production deployment run: `35587833815` (successful).
- Deployment evidence artifact: `salonai-production-deployment-v8.15.6-35587833815`.
- Final clean production P0 verification run: `35589035281` (successful).
- Final P0 evidence artifact: `salonai-production-p0-verification-35589035281`.
- Repository `main` additionally contains the workflow-only serialization guardrail from PR #213 at `9b91280cec07bf03e102ae77387d777d497f5e50`; that change does not alter the deployed application image.
- Developer 3 has no open PR. The latest workforce/profile/media recovery work was merged in PR #208 and released before the current production baseline.

## P0 — Production data-state and acceptance verification — COMPLETE

The governed production acceptance sequence is complete for release `v8.15.6`.

Final clean verification run `35589035281` executed after the successful production deployment and confirmed the intended application and data state through the protected production SSH trust path. No production database writes were required during this verification.

### 1. Governed Super Admin account verification — COMPLETE

Evidence from the final clean production run:

- exactly two requested accounts were resolved: `Francesco` and `Francesco Guerriero`;
- both are active `super_admin` accounts;
- both reported `changeRequired: false`;
- `selectedAccounts: 2`;
- no unintended account promotion was requested;
- no promotion write was necessary.

### 2. Service state migration and global bookability — COMPLETE

Production verification confirmed:

- service-state migration dry-run returned `candidates: 0`;
- `legacyServiceRecords: 0`;
- production contains canonical `active`, `published` and `bookable` service state;
- the cross-channel global-bookability correction was released in `v8.15.6`;
- deployed regression coverage proves canonical service bookability is enforced for customer booking, staff-managed booking and WhatsApp booking;
- the production service inventory includes at least one `bookable=false` service without requiring deletion or legacy `onlineBookable` state.

### 3. Production RBAC/workforce/stylist acceptance — COMPLETE

Final production evidence confirmed:

- the controlled production stylist roster contains nine records and requires no further classification changes;
- the live management workforce union reconciles all stylist profiles without fabricating login authority for profile-only staff;
- workforce reconciliation reported account-backed and profile-only rows successfully with every stylist profile represented;
- employee booking/publication state remains independently represented through `isActive`, `acceptsAppointments` and `profilePublished`;
- deployed RBAC regression tests passed for Super Admin, Administrator/delegated capability boundaries and permission middleware;
- booking eligibility continues to fail closed when required stylist state is missing or false;
- direct service/stylist booking enforcement is covered by the deployed backend P0 test set.

The final deployed P0 test subset reported `35` tests, `35` passed and `0` failed.

The production verification workflow was subsequently serialized with the production deployment concurrency lock in PR #213 so future P0 verification cannot overlap an active deployment.

## P0 — SendGrid transactional email production acceptance — BLOCKED ON PROVIDER/SECRET SETUP

The application-side SendGrid integration, signed Event Webhook verification, readiness tooling and acceptance sender are implemented. Production readiness was audited through the governed read-only workflow on 21 September 2026.

Latest production evidence:

- readiness workflow run: `35590746798`;
- evidence artifact: `salonai-production-sendgrid-readiness-35590746798`;
- live application release: `v8.15.6`;
- `readyForAcceptance: false`;
- `MESSAGE_DELIVERY_MODE` is already live;
- email delivery is already enabled;
- sender address is configured;
- SMTP relay configuration is valid;
- current provider remains `smtp`;
- current SMTP host is IONOS, not SendGrid;
- SendGrid API key is not configured;
- signed SendGrid Event Webhook is not enabled;
- SendGrid Event Webhook public verification key is not configured;
- SendGrid sender verification is not yet recorded as complete;
- SendGrid domain authentication is not yet recorded as complete.

Current readiness blockers:

1. `sendGridProvider`
2. `apiKeyConfigured`
3. `signedEventWebhook`
4. `senderVerified`
5. `domainAuthenticated`

Required completion sequence:

- complete SendGrid Sender Authentication/domain authentication for the production sending domain;
- create a SendGrid API key with the minimum required Mail Send permission and install it as `SENDGRID_API_KEY`;
- change production `EMAIL_PROVIDER` from `smtp` to `sendgrid` only after the SendGrid credentials and authenticated sender/domain are ready;
- configure the SendGrid Event Webhook endpoint at `/api/message-delivery/webhooks/sendgrid/events`;
- enable signed Event Webhook verification and install the SendGrid public verification key as `SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY`;
- set `SENDGRID_EVENT_WEBHOOK_ENABLED=true` only when the public verification key is present;
- record provider completion with `SENDGRID_SENDER_VERIFIED=true` and `SENDGRID_DOMAIN_AUTHENTICATED=true`;
- rerun the governed production SendGrid readiness audit and require `readyForAcceptance: true`;
- only then run one deliberate transactional acceptance send with `SENDGRID_ACCEPTANCE_CONFIRM=RUN_SENDGRID_EMAIL_ACCEPTANCE`;
- verify the signed delivered event reconciles the SalonAI `MessageDelivery` record;
- keep marketing-email activation as a separate acceptance step.

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
