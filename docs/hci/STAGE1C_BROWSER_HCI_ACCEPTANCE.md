# Stage 1C — Browser HCI and Accessibility Acceptance

**Roadmap:** AI Intelligent Business Platform v2.9  
**Reference vertical:** SalonAI  
**Issue:** #253  
**Implementation owner:** Developer 1  
**Depends on:** Stage 1B task-based Simple/Advanced management IA

## 1. Purpose

Stage 1B established the production information architecture. Stage 1C adds browser-level acceptance evidence against the rendered application so the HCI contract is verified beyond component tests and source-level regressions.

The browser suite deliberately exercises the authenticated management shell, local-storage persistence, keyboard interaction, delegated permissions, search discoverability, responsive layout and automated accessibility analysis.

## 2. Research and standards basis

The acceptance criteria follow these principles:

1. **Native navigation semantics:** the management workspace remains a named native `nav` landmark. WAI guidance recommends ordinary navigation links and disclosure buttons rather than applying ARIA `menu`/`menubar` semantics to site navigation.
2. **Keyboard-operable disclosure:** disclosure controls must remain native buttons and respond to standard button keyboard interaction. Enter/Space activation is expected by the WAI disclosure pattern.
3. **Visible state:** Simple/Advanced state is exposed with `aria-pressed`; section visibility uses `aria-expanded` and `aria-controls`.
4. **Permission separation:** presentation mode is tested after authentication/RBAC filtering. Advanced mode must never surface an unauthorised route.
5. **Discoverability:** authorised specialist tools remain searchable even when Simple mode is selected.
6. **Responsive operability:** mobile presentation controls must remain inside the management drawer and meet the project touch-target convention.
7. **Automated accessibility:** the rendered management navigation is scanned with Axe for serious/critical WCAG A/AA findings. Automated scanning supplements rather than replaces keyboard and human review.

References:
- https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
- https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/
- https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/navigation.html
- https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

## 3. Browser acceptance implemented

`frontend/e2e/management-navigation.spec.js` adds four independent acceptance journeys.

### 3.1 Simple/Advanced keyboard and persistence journey

The desktop test verifies that:

- Simple is the first-run default;
- routine work such as Appointments is visible in Simple;
- specialist AI tooling such as Haircare AI is absent from the default scan path;
- Simple-mode search can still discover an authorised Advanced tool;
- Simple and Advanced are sequential keyboard focus targets;
- the focused Advanced control exposes a visible outline;
- Enter activates Advanced through native button behaviour;
- authorised specialist tools become visible;
- the explicit Advanced preference is persisted under `salonai.managementNavigation.presentation.v1`;
- a browser reload restores Advanced;
- switching/persistence introduces no document-level horizontal overflow.

### 3.2 Delegated-permission non-bypass journey

A Receptionist fixture is granted only:

- `dashboard:view`;
- `appointment:read`.

The test switches that user to Advanced and proves:

- Booking demand remains discoverable because it is authorised by `appointment:read`;
- Haircare AI remains absent because the user lacks `ai:use`;
- Admin overview remains absent;
- searching for an unauthorised specialist tool returns the empty state rather than leaking the route.

This is browser evidence that the Stage 1B presentation layer is downstream of the existing authority model.

### 3.3 Authenticated Axe journey

The authenticated management navigation is scanned with `@axe-core/playwright`. The gate fails on any **serious** or **critical** violation returned for WCAG A/AA rule tags used by the existing SalonAI accessibility suite.

This keeps Stage 1C aligned with the repository's established automated-accessibility severity policy while adding authenticated management coverage.

### 3.4 Mobile drawer and touch-target journey

The mobile Chromium test opens the real management drawer and verifies that:

- the Simple/Advanced controls render inside the dialog;
- each control is at least 40px high and 44px wide, matching the current management-shell mobile convention;
- neither control escapes the drawer bounds;
- the document has no horizontal overflow;
- keyboard focus moves from Simple to Advanced;
- Enter activates Advanced and updates `aria-pressed`.

## 4. Test architecture

The Stage 1C suite reuses the same browser session contract already used by SalonAI layout regressions:

- authenticated token and user are placed in local storage before navigation;
- `/api/auth/me` is intercepted with the matching actor;
- feature-control reads are intercepted;
- unrelated API reads receive deterministic non-network responses.

No production credential, provider token or fixture password is added.

The test users are synthetic `@salonai.test` identities and exist only in browser fixtures.

## 6. Findings resolved during browser acceptance

The first Stage 1C browser run produced two useful failures rather than being waived:

- the test fixture removed the saved presentation preference on every page load, making a true reload-persistence assertion impossible. The fixture now resets the preference only once per browser test session and leaves subsequent reloads untouched;
- authenticated Axe scanning exposed legacy sidebar text colours below WCAG 2 AA normal-text contrast: task-group headings measured **4.22:1** and compact link descriptions **3.85:1** against the sidebar surface. The management-navigation stylesheet now uses darker scoped text colours for those elements instead of suppressing the Axe rule.

These findings demonstrate why Stage 1C uses rendered-browser evidence in addition to component tests.

## 5. Task-completion evidence

Stage 1C uses deterministic browser journeys as the automated baseline for selected management tasks. These are not presented as a substitute for moderated usability testing; they establish a repeatable minimum that DEV2 can compare with later human evidence.

| Representative task | Expected operator interactions after workspace is open | Automated completion signal | Error / assistance baseline | Responsive-fit evidence |
| --- | ---: | --- | --- | --- |
| Open routine appointment work from Simple view | 1 navigation activation | Appointments is visible in the default task hierarchy | 0 validation errors; no mode change or help required | Desktop shell and existing mobile drawer regressions |
| Find a specialist tool while remaining in Simple | 1 search entry + result activation when continuing | Management Copilot becomes discoverable and is labelled Advanced | 0 permission errors for an authorised actor; explanatory Advanced label is present | No document horizontal overflow |
| Switch from Simple to Advanced | 1 control activation | `aria-pressed` changes and authorised specialist tools render | 0 errors; no technical configuration step | Keyboard focus is visible; mobile control remains within drawer |
| Return to Advanced after reload | 0 additional configuration interactions | stored preference restores Advanced on reload | 0 errors; no assistance required | Desktop no-overflow assertion |
| Receptionist searches an authorised advanced booking tool | 1 mode activation + 1 search entry | Booking demand is visible | 0 permission errors for authorised `appointment:read` capability | Desktop authenticated shell |
| Receptionist searches an unauthorised AI tool | 1 search entry | no route is exposed; empty state appears | safe denial by omission, not an application error | Desktop authenticated shell |
| Switch view in mobile management drawer | 1 drawer open + 1 mode activation | Advanced state becomes pressed | 0 errors; native button keyboard behaviour | controls >= 40px high / 44px wide, stay inside dialog, no horizontal overflow |

For later moderated HCI sessions, record the same dimensions—task success, interaction/step count, completion time, observed errors, requests for assistance and subjective ease—so human findings can be compared with this automated baseline.

## 7. Acceptance gate

Stage 1C is complete only when all of the following pass on the Stage 1C PR head:

- backend validation;
- AI-service validation;
- frontend legacy/component tests;
- production frontend build;
- bundle budgets;
- full Playwright browser suite;
- authenticated management Stage 1C Playwright tests;
- repository security gate;
- dependency review;
- CodeQL;
- Backend Production Smoke.

Any red gate is treated as an integration blocker until explained and corrected.

## 8. Manual review remaining after automation

Automation cannot fully establish usability or assistive-technology quality. DEV 2 should still perform:

- keyboard-only management navigation review;
- screen-reader spot checks for view state, disclosure state and link naming;
- 200% zoom/reflow review;
- focus-not-obscured review with the sidebar/drawer scrolled;
- terminology review with representative receptionist/admin tasks.

DEV 3 should confirm delegated-role expectations against production RBAC definitions.

DEV 4 should confirm the presentation preference remains tenant-neutral UX metadata and is not promoted into a SaaS entitlement or tenant authority claim.

## 9. Boundary with Stage 1D

Stage 1C does not add or simulate external social-identity provider acceptance. Google/Facebook/Microsoft/Yahoo customer social login remains Stage 1D because provider-backed acceptance depends on provider configuration, redirect URIs and secrets that must be handled outside source control.
