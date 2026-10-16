# DEV2 #297 — Multi-location Presentation Handoff

Authority: #280  
Owner: DEV2 — presentation, HCI, accessibility and responsive behaviour  
Runtime authority: DEV3 / DEV4 contracts; DEV1 integration and release

## Product rule

The frontend consumes authoritative Business, Location, permission, entitlement, configuration, AI-review and connector state. It does not create that authority.

No component in this handoff may treat a browser-selected Business or Location identifier as trusted until the server-side runtime context has validated it.

## Component-to-contract mapping

| DEV2 component | Presented state | Required authority source | DEV2 boundary |
| --- | --- | --- | --- |
| `LocationContext` | active Business/Location label and context-change request | trusted runtime Business/Location context | request-only; does not decide permitted locations |
| `CapabilityStatus` | enabled/off/not-included/no-access | DEV4 product composition + server entitlement state | never computes entitlement |
| `EffectiveConfigurationRow` | effective value, provenance, lock/override/revert availability | server-resolved configuration inheritance plus DEV3 permission state | never resolves inheritance in React |
| `AIProposalDecision` | proposal evidence, uncertainty, approve/reject availability | AI proposal contract + DEV3 effective permission | never executes an AI action directly |
| `ConnectorHealth` | provider-neutral connector state, impact, diagnostics/reconnect availability | DEV1/connector runtime health contract + permission state | never infers health or mutates credentials |
| `ConversationOwnershipStatus` | bot/handoff/human ownership | existing WhatsApp conversation automation/assignment contract | reuses `automation.mode`, `handoffRequested`, `handoffReason`, `assignedTo`; no new ownership authority |
| `PlatformSurfaceState` | permission-denied/locked/plan-unavailable/error/empty | caller-supplied authoritative state | presentation only |
| `ContextSwitchWarningDialog` | unsaved-work warning before context-change request | local dirty-state + trusted next-context candidate from caller | never switches context itself |
| `ConfigurationChangePreviewDialog` | override/revert preview | authoritative effective configuration + caller permission | request-only; does not persist configuration |

## Effective-authority separation

DEV2 must not collapse entitlement and permission into one concept.

- DEV4/product-composition state answers whether a capability exists for the tenant.
- DEV3 effective authority answers whether the current user may perform an action.
- DEV2 presents both states and disables/hides actions only from caller-supplied authoritative values.

## Context-switch contract

A future runtime adapter may provide:

- authoritative Business label;
- authoritative active Location label;
- permitted Location choices;
- context revision/reference;
- action permission for requesting a context change.

DEV2 may render those values and emit a request callback. The adapter/server remains responsible for validating the requested context and returning the new authoritative state.

When unsaved work exists, the warning dialog must appear before the request is emitted. Escape means stay in the current context. Focus must return to the originating trigger when the dialog closes.

## Responsive acceptance

The presentation family must remain usable at:

- 320px viewport width;
- 360px viewport width;
- 390px viewport width;
- tablet widths;
- desktop widths.

Acceptance rules:

1. no horizontal page overflow at 320px;
2. primary interactive targets remain at least 44x44 CSS pixels;
3. labels wrap rather than truncate critical Business/Location/capability meaning;
4. status is never conveyed by colour alone;
5. dialogs remain inside the viewport and allow internal scrolling when content exceeds the available height;
6. visible focus remains present for keyboard navigation;
7. context-switch and configuration-preview dialogs must not create modal-on-modal flows;
8. screen-reader names must remain stable and must not incorporate decorative counters/icons.

## Browser/accessibility validation

The repository CI already runs the production frontend build, component tests and Playwright accessibility/browser suite. Because #297 deliberately introduces no runtime route wiring, these prop-driven components are primarily validated through Vitest/Testing Library until an authoritative context adapter exposes them in a real route.

When route wiring becomes available, DEV2 browser acceptance must add coverage for:

- 320px and 390px viewport overflow;
- keyboard-only context-change flow;
- Escape/return-focus behaviour;
- axe WCAG A/AA serious/critical violations;
- locked/no-access/plan-unavailable/error/empty states;
- connector-health recovery requests;
- AI proposal review actions gated by authoritative permission.

## Integration gate

Do not wire these components into a production route until the relevant trusted runtime selector/context endpoint or adapter exists.

DEV1 owns integration/release. DEV3 owns effective permission. DEV4 owns tenant/product/location/configuration authority. DEV2 owns presentation and HCI behaviour only.
