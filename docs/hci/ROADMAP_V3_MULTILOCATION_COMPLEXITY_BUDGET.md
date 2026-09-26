# Roadmap v3.0 — Multi-Location UX Complexity Budget

Owner: DEV2  
Issue: #277  
Baseline: `main@b14f56e801ee4337cef765f1b40cb0e555ed7217`

## Purpose

The Zenoti benchmark demonstrates the commercial value of broad enterprise functionality, but public product feedback also highlights the usability cost of dense configuration and click-heavy administration. AI Intelligent Business Platform should retain enterprise capability while enforcing a measurable complexity budget.

This document starts the HCI audit. It does not define tenancy, RBAC or business rules.

## Priority journeys

| Journey | Primary user | Initial target |
| --- | --- | --- |
| Switch active location | Owner / manager / receptionist | one persistent context control; current location always visible |
| Understand inherited settings | Owner / admin | effective value + source visible without reading technical schemas |
| Override a location setting | Authorised admin | preview impact, explain lock, confirmation for material changes |
| Review AI proposal | Manager / authorised staff | evidence, rationale, affected records, permission and approval state visible together |
| Inspect connector health | Owner / admin | provider state, last sync, failure and recovery action on one surface |
| Staff daily operations | Staff / receptionist | no exposure to tenant configuration not needed for the task |

## Complexity budget

For representative tasks record:

- successful completion rate;
- median task-completion time;
- navigation-step count;
- form-field count;
- error/recovery count;
- help/assistance required;
- keyboard-only completion;
- viewport overflow or modal containment defect;
- accessibility defect count;
- user-reported confidence after completion.

A material redesign should not increase steps or task time without a documented reason such as added safety, legal consent or explicit confirmation.

## Interaction rules

1. The active business/location context must be continuously visible on management surfaces where actions are location-sensitive.
2. Changing context must not silently discard unsaved work.
3. Effective configuration should show **value + inherited source + lock/override state**.
4. Advanced tenancy diagnostics belong behind progressive disclosure.
5. Capability packs and entitlements should explain why a function is unavailable rather than presenting a dead control.
6. Permission errors should identify the unavailable action without revealing unauthorised tenant/location data.
7. Dialogs, drawers and popovers must remain within the viewport at supported breakpoints.
8. Mobile workspaces should prioritise operational tasks rather than reproduce every desktop administration control.

## Prototype set

Prepare Figma flows for:

1. business/location switcher;
2. owner dashboard with location context;
3. effective-configuration inspector;
4. controlled location override;
5. capability/entitlement explanation;
6. AI Advice Centre and proposal review;
7. connector-health summary.

Each prototype should cover desktop and at least one narrow/mobile breakpoint and include keyboard/focus expectations.

## Handoff gate

DEV2 hands implementation-ready flows to DEV1/DEV4 only after:
- terminology is consistent with the shared platform contracts;
- DEV3 confirms permission semantics where relevant;
- prototype review identifies no critical viewport/accessibility issue;
- the proposed flow does not create a duplicate management surface.
