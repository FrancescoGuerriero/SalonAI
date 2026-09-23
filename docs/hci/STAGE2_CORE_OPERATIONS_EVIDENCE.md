# Stage 2 Core Salon Operations — HCI and Release Evidence

**Roadmap:** AI Intelligent Business Platform v2.9  
**Authority:** Issue #246  
**Reference vertical:** SalonAI  
**Primary workspace:** Appointment Operations  
**Status:** Stage-2 acceptance evidence for PR #259

## 1. Interaction objective

Stage 2 expands salon booking modes without creating separate operational applications. Reception, administration and permitted staff must continue to understand an appointment as the primary unit of work whether it originated from an ordinary booking, walk-in, service package, group booking or service trial.

The design therefore keeps the existing Appointment Operations workspace as the task anchor.

## 2. Representative staff tasks

### Routine appointment work

1. Open Appointment Operations.
2. Review date/status/search filters and the appointment list.
3. Manage an individual canonical appointment.
4. Change status, reschedule, request payment or queue an allowed reminder.

This remains the default visual path and must not be displaced by specialist workflows.

### Group booking

1. Choose **Group booking** from **Special booking workflows**.
2. Find/select the organiser.
3. Add at least two participant rows.
4. Select each participant's customer, service, stylist and start time.
5. Submit once.
6. If any participant conflicts with canonical availability rules, initial creation fails atomically.
7. After creation, add, reschedule or change an individual participant without rebuilding the group.
8. Apply a status to the whole group when useful; participant-level failures are reported explicitly instead of hiding partial completion.

### Service trial

1. Choose **Service trial** from **Special booking workflows**.
2. An authorised service manager creates or edits the controlled trial definition.
3. An authorised booking user finds a customer and selects trial, stylist and start time.
4. The backend owns trial price, duration, validity, eligibility and repeat restrictions.
5. A later standard appointment for the same customer/service can be recorded as a conversion within the trial's configured conversion window.

## 3. Progressive disclosure

Group Bookings and Service Trials are not rendered as permanently expanded panels. A compact task switcher exposes only enabled specialist workflows and mounts the selected workflow on demand.

This preserves:

- rapid access to the ordinary appointment list;
- lower visual density for reception work;
- reduced unnecessary API activity;
- one coherent operational information architecture;
- reversible feature-control visibility.

The task buttons use `aria-pressed`, labelled grouping and minimum 44px-style target sizing through `min-h-11`.

## 4. Responsive and modal containment

The new Stage-2 workflows use inline responsive grids rather than new full-screen or viewport-overflow modals. Existing Appointment Operations modal containment remains unchanged.

Acceptance expectations:

- no horizontal page overflow at representative mobile/tablet/desktop widths;
- form controls retain explicit labels;
- task buttons are keyboard reachable;
- focus follows normal document order;
- errors use `role="alert"`;
- successful operations use `role="status"`;
- specialist panels can be collapsed without losing the ordinary appointment workflow.

## 5. RBAC and visibility

Frontend affordances mirror existing server permission vocabulary:

- `appointment:read`
- `appointment:create`
- `appointment:update`
- `appointment:cancel`
- `service:update` for trial-definition management

No `group-booking:*` or `trial:*` permission namespace is introduced.

Cancellation-only users are only offered the cancellation status option. Backend permission middleware remains authoritative regardless of frontend visibility.

Feature controls:

- `group-bookings`
- `service-trials`

Disabling either capability hides its specialist workflow and fails its dedicated API routes closed. Existing canonical Appointment records remain available through ordinary appointment operations.

## 6. Source-of-truth safeguards

### Group booking

The GroupBooking aggregate stores:

- organiser reference;
- title/notes;
- participant presentation label;
- participant canonical Appointment reference.

Participant customer, service, stylist, timing, price and status are not duplicated into the group aggregate. A unique multikey index prevents one canonical Appointment from being attached to multiple group aggregates.

Initial participants are created sequentially within one MongoDB transaction through the canonical appointment-management service. This preserves the shared availability/conflict engine and prevents partially-created initial groups.

### Service trial

ServiceTrial definitions do not mutate permanent Service price or duration.

A trial booking:

- atomically claims customer eligibility;
- creates one canonical Appointment;
- stores immutable price/duration/eligibility snapshots for audit;
- records conversion against a later normal canonical Appointment only.

## 7. Performance and quality acceptance

Stage-2 completion requires the exact final PR head to pass:

- backend validation;
- frontend legacy and component tests;
- production frontend build;
- frontend bundle budget;
- Playwright browser/accessibility checks;
- repository security/Trivy gate;
- dependency review;
- AI-service validation;
- CodeQL JavaScript/TypeScript and Python;
- production backend startup smoke.

The specialist workflow switcher also avoids loading group/trial API data until the corresponding task is opened.

## 8. Queue intelligence decision

Queue intelligence (6G) is intentionally not implemented as a synthetic predictor in Stage 2.

Roadmap v2.9 requires real operational data before predictive wait-time or AI queue optimisation is promoted. The deterministic reception/walk-in workflow remains authoritative. Queue intelligence moves to the shared AI/ML evaluation path once sufficient production data, documented baselines, evaluation metrics and rollback/monitoring are available.

This deferral is a Stage-2 quality decision, not an unfinished duplicate booking feature.

## 9. Stage-2 gate

Stage 2 is acceptable when:

- 6A–6F operate through canonical appointment/customer/service/payment authorities;
- group and trial workflows are permission- and feature-controlled;
- no competing booking application or availability engine exists;
- retained specialist records are auditable;
- ordinary reception/appointment work remains the default, uncluttered task path;
- the final-head CI/security/browser/smoke evidence is green;
- 6G remains explicitly data-gated rather than being represented by unvalidated AI.
