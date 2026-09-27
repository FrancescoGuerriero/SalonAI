# DEV2 #353 — AIIBP Tenant Installation & Composition UX

Authority: #280  
Owner: DEV2 — UX/HCI/accessibility/Figma  
Runtime provisioning authority: DEV4 #295  
Status: Figma-first / no runtime provisioning

## Governing model

AIIBP is the product source of truth.

A tenant product is assembled from:

```
AIIBP Core
  -> Vertical pack
  -> Capability modules
  -> Tenant configuration
  -> Branding / terminology
  -> Locations / domains
  -> Integrations
  -> governed extensions
  -> tenant installation
```

The UX must make that composition visible without implying that a tenant receives a separate fork or repository.

## Product classification vocabulary

Every configurable product element presented in this flow should be classified as one of:

- **CORE** — shared platform capability, not tenant-removable when required by the platform.
- **MODULE** — reusable optional capability.
- **VERTICAL** — vertical-specific defaults/rules/templates.
- **TENANT CONFIGURATION** — tenant-specific values and overrides.
- **GOVERNED EXTENSION** — explicit extension point for genuinely bespoke behaviour.

The UI must never offer “custom fork” as a tenant option.

## Installation flow

### Step 1 — Installation workspace

Show:
- AIIBP release/version;
- installation id/reference;
- current mode: Dry run / Write request;
- selected vertical;
- Business name when known;
- readiness status;
- blockers/warnings.

Default mode is **Dry run**.

Write mode is only a request state and requires authoritative backend permission plus explicit confirmation.

### Step 2 — Select vertical

The UI consumes the registered vertical list from the platform registry.

Example display only:
- Salon AI
- Spa AI
- Plastic Surgery AI
- Fitness AI

For each vertical, show:
- display name;
- short description;
- default terminology;
- default capability set;
- compatibility warnings if provided by the backend.

DEV2 must not hard-code authority from the displayed vertical selection.

### Step 3 — Tenant identity & locale

Present fields for:
- Business name;
- slug;
- initial status;
- locale;
- timezone;
- currency;
- optional existing owner/admin account binding.

Validation presentation:
- available;
- conflict;
- invalid;
- pending authoritative check.

The browser does not establish uniqueness.

### Step 4 — Primary location & domains

Present:
- primary Location name;
- address/region data when part of the authoritative contract;
- primary domain;
- optional app-domain/subdomain;
- domain state: pending / active / disabled;
- collision / invalid / unavailable states.

No DNS mutation occurs in this UX.

Domain status must clearly distinguish:
- requested;
- pending verification;
- active;
- disabled;
- blocked/collision.

### Step 5 — Capability composition

Capability selection is organised into categories.

Suggested categories:
- Customer & CRM
- Booking & availability
- Commerce
- Communications
- Workforce
- Inventory
- Calendar
- Loyalty / memberships / packages
- Marketing / retention
- Analytics / BI
- AI Adviser / AI Workforce
- Consultation / vertical intelligence

Each capability card renders authoritative metadata such as:

```js
{
  capabilityId: "booking",
  name: "Booking & availability",
  classification: "MODULE",
  source: "vertical-default",
  state: "included",
  selectable: true,
  required: false,
  reason: null
}
```

Presentation states:
- required core;
- vertical default;
- optional selected;
- optional available;
- not included;
- incompatible;
- blocked by dependency;
- tenant override.

The frontend does not compute entitlement.

### Step 6 — Branding & terminology

Present tenant-level composition for:
- logo/brand identity;
- theme choice;
- primary/accent treatment;
- public business name;
- terminology overrides;
- selected public navigation/modules;
- public content/template pack.

Important rule:
theme and terminology may vary per tenant without changing the underlying application codebase.

### Step 7 — Integration planning

Provider-neutral integration planning cards for:
- Email
- SMS / WhatsApp
- Calendars
- Payments
- Analytics / marketing
- External business systems

States:
- not configured;
- planned;
- connected;
- attention required;
- unavailable.

Do not display secrets or raw credentials.

### Step 8 — Extension decision

When the requested business behaviour is not represented by current configuration, the UX should classify the need:

1. existing tenant configuration;
2. existing reusable module;
3. vertical capability;
4. candidate reusable platform capability;
5. governed tenant extension.

The interface should explicitly warn against tenant-specific core forks.

### Step 9 — Dry-run review

Review panel should show:

- Business to create/reuse;
- Location to create/reuse;
- domain records to create/reuse;
- owner/admin membership intent;
- selected vertical;
- capability composition;
- configuration overrides;
- integration intentions;
- extensions;
- conflicts;
- unresolved blockers.

Dry run result states:
- CREATE
- REUSE
- SKIP
- BLOCKED
- WARNING

No write is performed.

### Step 10 — Write confirmation

Only available if the authoritative runtime contract allows it.

Confirmation must state:
- this will request creation/update of platform resources;
- pending domains are not DNS activation;
- capability intent is not equivalent to billing/subscription activation unless a future billing authority confirms it;
- server will revalidate authority, collisions and current state.

### Step 11 — Installation report

Future provisioning report presentation:

```js
{
  referenceId: "opaque-reference",
  mode: "dry-run",
  status: "ready | blocked | completed",
  created: [],
  reused: [],
  skipped: [],
  blocked: [],
  warnings: [],
  activationReady: false
}
```

Do not expose secrets or unnecessary internal identifiers.


## #352 product-composition contract alignment

DEV2 now consumes the review-ready DEV4 #352 / PR #356 vocabulary for tenant product composition. This remains descriptive/presentation work until that contract is integrated.

### Manifest metadata

The installation and upgrade UX should be able to present:

- schema version;
- platform version;
- Business identity;
- vertical id;
- plan key;
- capability pack keys;
- configuration profile;
- theme profile;
- terminology profile;
- integration bindings;
- AI capability keys;
- workflow pack keys;
- data policy profile;
- approved extension keys;
- deployment profile;
- manifest revision;
- manifest status;
- effective-from date/time;
- deterministic manifest hash where review evidence requires it.

Manifest statuses:
- `draft`;
- `active`;
- `suspended`;
- `archived`.

Deployment profiles:
- `shared-saas`;
- `dedicated`.

Dedicated deployment must remain the same versioned AIIBP product composition and requires infrastructure review; it is not a code fork.

### Effective capability provenance

Capability state must display the authoritative explanation returned by the composition resolver.

Canonical reason values currently include:

- `tenant-manifest`;
- `vertical-default`;
- `platform-safety-lock`;
- `not-entitled`;
- `feature-flag-disabled`;
- `dependency-unavailable:<capability-key>`.

Upgrade comparison may additionally use:
- `not-selected`.

DEV2 wording should translate these codes into operator language while preserving the underlying reason for diagnostics/audit.

Suggested presentation mapping:

| Resolver reason | Operator-facing meaning |
| --- | --- |
| tenant-manifest | Selected explicitly for this tenant |
| vertical-default | Included by the selected vertical |
| platform-safety-lock | Disabled by a platform safety control |
| not-entitled | Not available under current entitlement |
| feature-flag-disabled | Temporarily not exposed by rollout control |
| dependency-unavailable:* | Unavailable because a required capability is unavailable |
| not-selected | Not selected in this composition |

The frontend must not recompute these reasons.

### Upgrade review contract

A tenant product upgrade review may present:

- current manifest revision -> next revision;
- current platform version -> next platform version;
- current manifest hash;
- next manifest hash;
- capability transitions;
- capabilities to enable;
- capabilities to disable;
- profile changes;
- tenant acceptance requirement;
- infrastructure review requirement;
- platform-upgrade review requirement;
- experimental-capability approval requirement;
- deterministic upgrade fingerprint.

Each capability transition may present:
- capability key/label;
- lifecycle status;
- from enabled -> to enabled;
- from reason -> to reason;
- required permissions;
- integration contracts;
- metering key when the authoritative contract exposes it.

No upgrade write is performed by the review UI.

### Activation approval contract

Activation review must be able to present these canonical approval reasons:

- `initial-tenant-product-activation`;
- `tenant-product-change`;
- `platform-version-upgrade-review`;
- `deployment-infrastructure-review`;
- `experimental-capability`.

The activation plan may also expose:

- from revision / to revision;
- current manifest hash;
- candidate draft manifest hash;
- active manifest hash;
- enabled capability keys;
- disabled capability keys;
- persistence intent:
  - archive current manifest;
  - activate candidate manifest;
- deterministic activation fingerprint;
- `writesPerformed: false` during planning.

DEV2 must present persistence intent as a reviewable plan, not as proof that writes happened.

### Product-composition review UX rule

The operator should be able to answer, without reading source code:

> What product composition is this tenant running, what is changing, why is each capability available/unavailable, what approvals are required, and which review fingerprint identifies this exact plan?


## Deployment topology presentation

The tenant product may later be deployed as:

- shared SaaS;
- dedicated environment.

Dedicated deployment must be described as running the same versioned AIIBP release/modules, not a divergent product branch.

DEV2 only presents this choice if DEV4/DEV1 expose it as an authoritative deployment option.

## Accessibility acceptance

- keyboard-complete step navigation;
- no modal-on-modal flow;
- visible focus;
- 44x44 CSS px primary targets;
- classification/state always has text, not colour alone;
- current step announced programmatically;
- validation/conflict errors associated with the relevant field;
- dry-run result summary readable linearly by screen reader;
- no required horizontal scroll at 320 CSS px;
- write confirmation uses explicit action wording;
- focus returns to the initiating control after dialogs/sheets close.

## Responsive acceptance

### Desktop
- persistent installation summary rail;
- main step content in central workspace;
- capability composition may use multi-column card layout.

### Tablet
- summary collapses into top status strip;
- two-column capability layout where width allows.

### Mobile 320–390px
- single-column flow;
- sticky bottom action bar;
- step title + progress remain visible;
- capability cards stack;
- summary opens as one sheet/dialog only;
- no fixed-width tables.

## Error / blocked states

Explicitly design:
- unsupported vertical;
- slug collision;
- domain collision;
- invalid domain;
- capability dependency conflict;
- capability incompatible with vertical;
- owner binding unavailable;
- no authoritative permission;
- stale dry-run result;
- provisioning runtime unavailable;
- installation partially blocked.

## Contract boundary

DEV2 may build:
- Figma flows;
- presentation components;
- accessibility behaviour;
- review/summary UI;
- error/loading/empty states;
- prop-level contracts.

DEV2 must not build:
- provisioning authority;
- uniqueness logic;
- DNS mutation;
- tenant creation service;
- BusinessMembership creation rules;
- entitlement/billing authority;
- deployment orchestration;
- code/repository generation.

## Implementation handoff

When DEV4 activates #295, the preferred integration flow is:

```
authoritative provisioning contract
        ↓
DEV2 presentation components
        ↓
dry-run request
        ↓
server-generated plan/report
        ↓
human review
        ↓
explicit write request
        ↓
server revalidation
        ↓
provisioning result
```

## Figma deliverable inventory

Current page: **DEV2 #353 — Tenant Installation**

Built and visually reviewed:
- 00 — Installation Model
- 01 — Vertical Selection
- 02 — Business Identity & Locale
- 03 — Location & Domain Setup
- 04 — Capability Composition
- 05 — Branding & Terminology
- 06 — Integration Planning
- 07 — Dry-run Review
- 08 — Installation Report
- 09 — Mobile Dry-run Review (390px)
- 10 — Tablet Capability Composition (768px)
- 11 — Write Confirmation
- 12 — Collision & Blocked Recovery States
- 13 — Effective Product Composition & Provenance
- 14 — Manifest Revision & Deployment Profile
- 15 — Tenant Product Upgrade Review
- 16 — Activation Approval & Fingerprint
- 17 — Mobile Upgrade Review

Figma file:
https://www.figma.com/design/iNumviutWfqBibpl43cKSC
