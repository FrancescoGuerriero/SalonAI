# DEV2 #353 — AIIBP Tenant Installation & Composition UX

Authority: #280  
Owner: DEV2 — UX/HCI/accessibility/Figma  
Runtime provisioning authority: DEV4 #295  
Integration/release authority: DEV1

## Product rule

AIIBP is the product source of truth. Tenant products are configured/provisioned installations assembled from platform core, reusable modules, vertical packs and tenant configuration. A tenant installation must never become a source-code fork.

## Authority boundary

DEV2 owns presentation, interaction behaviour, responsive layout and accessibility. DEV2 does not create Business, Location, BusinessMembership, entitlement, RBAC, DNS, billing, connector or provisioning authority.

The frontend consumes authoritative state and emits request callbacks. Server-side contracts remain responsible for validation, collision checks, effective permission, entitlement and writes.

## Installation flow

1. installation workspace;
2. vertical selection;
3. Business identity and locale;
4. primary Location and domain lifecycle;
5. capability composition and provenance;
6. branding, terminology and public-module visibility;
7. integration planning;
8. governed extension boundary review;
9. dry-run review and blockers;
10. explicit write-request confirmation;
11. machine-readable installation report presentation;
12. activation-readiness state.

## Classification vocabulary

Tenant requirements must be represented as one of:

- platform core;
- reusable module;
- vertical pack/default;
- tenant configuration;
- governed tenant extension.

A tenant-specific code fork is not an installation option.

## Capability state

The UI may present server-supplied states such as:

- platform core / mandatory;
- vertical default;
- tenant-manifest selection;
- optional capability;
- not selected;
- not entitled;
- feature-flag disabled;
- dependency unavailable;
- platform safety lock;
- unavailable/incompatible.

Entitlement is not permission. DEV3 effective authority remains a separate caller-supplied contract for action availability.

## Installation readiness

Presentation states:

- ready;
- stale dry-run;
- provisioning runtime unavailable;
- partially blocked;
- blocked.

Recovery controls are request-only and must remain hidden unless the caller supplies authoritative action permission.

## Machine-readable installation report presentation

The future server-generated report is presented without executing provisioning. The UX supports:

- created resources;
- reused resources;
- skipped resources;
- blocked resources;
- warnings;
- unresolved dependencies;
- activation readiness;
- opaque audit/reference id.

Raw credentials and secrets must never be rendered. A screen-reader summary must communicate the counts and readiness without relying on colour or visual layout.

## Governed extension boundary

Custom requirements are reviewed as:

- existing configuration;
- reusable module;
- vertical extension;
- governed tenant extension.

The presentation does not decide architecture. It displays the classification supplied by the platform workflow and explains why a tenant code fork is rejected as the default implementation path.

## Domain and integration safety

Domain presentation may show pending, active, disabled, collision and error state, but it must not mutate DNS.

Integration planning may show provider-neutral state for email, SMS/WhatsApp, calendars, payments, analytics/marketing and external business systems. Credentials are configured outside the presentation layer.

## Responsive acceptance

Validate presentation behaviour at:

- 320px;
- 360px;
- 390px;
- tablet;
- desktop.

Acceptance rules:

1. no horizontal overflow at 320px;
2. minimum 44x44 primary interactive targets;
3. visible keyboard focus;
4. stable accessible names;
5. status never conveyed by colour alone;
6. dialogs remain viewport-safe and internally scroll when needed;
7. no modal-on-modal interaction;
8. blocker/error states expose explicit recovery guidance;
9. screen-reader-readable composition/report summaries;
10. write-request confirmation is explicit and only available from authoritative caller permission.

## Runtime integration gate

DEV4 #295 remains deferred. Therefore this implementation intentionally contains no production provisioning API or route wiring.

When DEV4 activates #295, DEV2 may consume its validated dry-run/report/write-request contract, but must not duplicate it. DEV1 remains responsible for integration/release and DEV3 remains responsible for effective action authority.

## Current DEV2 implementation

Current-main implementation authority is PR #420. It consolidates the valid historical #353 stack and includes:

- installation review;
- vertical selection;
- identity/locale summary;
- location/domain lifecycle;
- branding/terminology;
- integration planning;
- product composition/provenance/upgrade/activation review;
- workspace shell;
- explicit readiness/error states;
- machine-readable installation report presentation;
- governed extension boundary review;
- focused component tests.

Historical PRs #401, #404, #406, #408, #409 and #410 are traceability evidence only and must not be force-merged.
