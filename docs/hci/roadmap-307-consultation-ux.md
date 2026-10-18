# Roadmap #307 — consultation UX presentation contract

Issue: #307  
DEV2 implementation issue: #455  
Figma file: `roTSaBJuQTYNJpBInNahXQ`  
Figma page: `03 Consultation UX` (`22:2`)

## Purpose

This document closes the DEV2-owned presentation slice of the planned WhatsApp AI Consultation Engine without creating consultation-domain, permission, tenant, booking or AI authority in React.

The presentation layer is deliberately **props-driven and request-driven**. Owning application/controller code supplies trusted state and permitted actions. These components render that state and raise callbacks; they do not decide whether an action is allowed or mutate canonical consultation state themselves.

## Figma prototypes

The editable AIIBP design-system file contains four implementation-ready consultation views built with the existing AIIBP semantic/layout variables, typography styles and published Button component:

- `22:3` — **Consultation — Customer Desktop**
- `22:71` — **Consultation — Customer Mobile**
- `22:100` — **Consultation — Staff Review Desktop**
- `22:193` — **Consultation — System States & Accessibility**

The prototypes cover the first agreed vertical, hair-colour / chemical-service consultation, but the interaction primitives are intentionally reusable across later consultation definitions.

## React presentation primitives

### `ConsultationProgress`

Renders structured consultation progress from server/controller-supplied steps.

Contract:

- `steps`: ordered labels or `{ id, label }` records;
- `currentStep`: one-based current position;
- `statusText`: optional authoritative/user-facing status override.

Accessibility:

- ordered-list structure preserves sequence;
- the current item uses `aria-current="step"`;
- completed/current/upcoming states are expressed in text/structure, not colour only;
- the status announcement uses a polite live region.

### `ConsultationQuestionCard`

Responsive customer-facing question surface.

Contract:

- receives the question, description, options and selected value;
- selection invokes `onRequestSelect` rather than owning consultation state;
- continue/save/handoff controls appear only when their request callbacks are provided;
- `busy` disables the fieldset/actions and announces an in-progress state;
- explanatory safety/context text can be supplied with `hintTitle` / `hint`.

This component can be composed into authenticated web/mobile consultation flows and can mirror the same structured question semantics used by WhatsApp.

### `ConsultationSurfaceState`

Reusable presentation states:

- `loading`
- `incomplete`
- `error`
- `handoff`
- `low-confidence`
- `complete`

Error uses an assertive alert. Non-critical state changes use polite status announcements. Loading exposes `aria-busy`. Retry/continuation remains a callback request, not an implicit mutation.

### `ConsultationReviewWorkspace`

Staff-review presentation surface for structured evidence, attention flags, AI-assisted recommendation and permitted decision actions.

Contract:

- `summaryItems` and `answers` are display records supplied by the owning consultation API/controller;
- `recommendation` displays title, rationale and confidence label;
- recommendation language explicitly remains advisory;
- `flags` display authoritative attention/risk labels;
- `actions` render only when an action has a label **and** an `onRequest` callback;
- `busyAction` disables concurrent actions and announces the pending operation.

The component does **not** infer `consultation:*` permissions. DEV3/server effective authority remains responsible for deciding which callbacks/actions are supplied.

## Responsive behaviour

The Figma views and React primitives use progressive disclosure rather than duplicating separate business workflows:

- desktop can show progress beside the active consultation content;
- mobile collapses progress to the current stage and stacks controls vertically;
- staff review uses a summary/evidence two-column layout at large widths and a single reading column below that breakpoint;
- actions wrap/stack rather than overflowing;
- no modal is required for the main review workflow.

## Human / AI ownership

Consultation UI must preserve the existing conversation ownership model:

- when a human handoff is active, the interface states that AI replies are paused;
- returning a conversation to AI is presented only when authoritative application state supplies the action;
- the frontend never assumes that a stale handoff may be cleared;
- WhatsApp transport status and consultation review status are separate concepts.

## AI presentation and safety

AI output must be clearly described as **AI-assisted** or **advisory**. The UI must never imply that model confidence overrides deterministic safety/business rules or required human review.

Low-confidence presentation should include the available rationale/evidence and preserve a human-review path. The frontend must not manufacture thresholds, diagnoses, allergy/safety outcomes, service eligibility or booking eligibility.

## Accessibility acceptance

Production routes that compose these components must preserve these requirements:

1. visible reading order matches keyboard order;
2. current progress is conveyed structurally and textually;
3. all actionable controls retain at least a 44×44 CSS-pixel target through the existing SalonAI button/control conventions;
4. validation identifies the affected question/field and never relies on colour alone;
5. async save, retry, handoff and review-action changes use appropriate live-region semantics;
6. loading retains explanatory text and `aria-busy`, rather than exposing an unexplained spinner;
7. errors preserve user-entered data at the controller/form layer and make retry explicit;
8. reduced-motion users receive equivalent state information without animation dependency;
9. focus is not programmatically moved for routine background saves; move focus only for a material context transition or valid modal/dialog workflow;
10. permitted staff actions are server/controller supplied; hiding a control is presentation, not access control.

## Authority boundaries

DEV2 owns:

- consultation interaction/presentation model;
- responsive layout;
- progress and system-state presentation;
- accessible interaction semantics;
- staff review information hierarchy;
- Figma prototypes.

DEV2 does **not** own:

- `ConsultationSession` persistence/lifecycle;
- Node ↔ Python orchestration;
- model/prompt/ruleset execution;
- customer/appointment mutation;
- tenant or location ownership;
- RBAC/effective permissions;
- safety/business-rule truth;
- booking eligibility;
- training-data governance.

Those remain with the authoritative domain/integration/RBAC/SaaS/AI lanes defined in #307.

## Integration sequence

When #307 backend/domain work activates, consume these components rather than recreating consultation presentation:

1. server resolves trusted Business/Location/customer/conversation/effective authority;
2. consultation API supplies structured state, steps, evidence, recommendation and permitted actions;
3. route/controller maps that authoritative response into these props;
4. request callbacks call the canonical API;
5. pending/success/error responses update the authoritative state and presentation;
6. tests verify cross-tenant/RBAC/business rules at their owning server layers, while frontend tests verify semantic/accessibility behaviour.

## DEV2 completion

The DEV2 deliverable is complete when these presentation components, focused tests and this contract are merged, with the Figma prototypes retained as the implementation reference. The broader #307 issue remains open for its domain, orchestration, RBAC, SaaS and AI work; those dependencies do not require another DEV2 design stream unless a concrete presentation defect is discovered.
