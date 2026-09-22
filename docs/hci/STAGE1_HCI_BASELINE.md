# Stage 1 HCI Baseline — Identity, Permissions and Management UX

**Roadmap:** AI Intelligent Business Platform v2.9  
**Reference vertical:** SalonAI  
**Stage:** 1 — Identity, permissions & UX/HCI foundation  
**Issue:** #253  
**Owner:** Developer 1  
**HCI audit lead:** Developer 2  
**RBAC/staff completeness:** Developer 3  
**Platform-boundary review:** Developer 4

## Purpose

This file establishes the evidence baseline for Stage 1. It does not prescribe a wholesale redesign. It identifies representative users, high-value tasks, current authoritative implementation, measurable usability risks and the minimum evidence required before a material interaction change is accepted.

The guiding rule is: **design around user tasks, while keeping server-side business rules and permissions authoritative**.

## 1. Existing evidence that must be preserved

Current `main` already contains substantial HCI/UX hardening:

- management aliases redirect to canonical workspaces rather than appearing as competing tools;
- Team Availability terminology replaced the ambiguous Staff Management navigation entry;
- dense management sections use progressive disclosure;
- management navigation has one lightweight route/label/permission/feature registry;
- Admin navigation is permission-driven while Super Admin remains the sole unconditional management bypass;
- Add Employee and Product dialogs use viewport-safe portal/scroll patterns;
- catalogue card templates were rebuilt to prevent action/metadata drift caused by mixed content length;
- public Playwright Axe checks cover WCAG 2 A/AA and WCAG 2.1 A/AA serious/critical violations;
- layout/browser tests cover responsive and viewport-sensitive interactions;
- route/bundle performance budgets already protect interaction performance.

Stage 1 must extend this evidence instead of replacing it.

## 2. Representative users

### Customer

Primary goals:
- discover a service/product/stylist;
- create/sign into an account;
- understand available sign-in methods;
- book or manage an appointment;
- complete permitted self-service actions;
- receive clear confirmation/error feedback.

HCI risks:
- confusing social sign-in with provider/calendar authorisation;
- unclear account-link collisions;
- too many decisions during booking/account creation;
- inaccessible validation or ambiguous recovery after an authentication error.

### Salon employee / stylist

Primary goals:
- sign in when access is enabled;
- understand today’s work and own schedule;
- access only assigned management capabilities;
- manage permitted profile/schedule/service information;
- complete routine work without navigating technical administration areas.

HCI risks:
- permissions represented as unexplained missing functionality;
- employee operational state confused with application sign-in state;
- routine tasks buried among management/AI/premium tools.

### Receptionist / manager

Primary goals:
- manage appointments and reception workflow quickly;
- find customers, services and employees;
- handle schedule/availability within delegated permission;
- recognise which actions require higher authority;
- recover from validation/conflict errors without losing entered work.

HCI risks:
- high information density;
- excessive navigation steps;
- management menu complexity;
- permission denials appearing late in a workflow;
- duplicate routes/workspaces causing uncertainty over the authoritative action.

### Administrator / Super Admin

Primary goals:
- manage employees, roles and delegated permissions;
- configure features and integrations;
- understand system/connector readiness;
- access advanced tools without overwhelming routine business management;
- distinguish operational settings from technical diagnostics.

HCI risks:
- large side-menu catalogue;
- advanced/technical tools mixed with routine salon operations;
- accidental assumption that visible UI implies permission authority;
- configuration pages exposing provider/API terminology unnecessarily.

## 3. Priority Stage-1 journeys

### Journey A — Customer authentication

Conceptual flow:

`Login/Create Account -> provider or email/password -> authentication result -> account/linking decision -> account experience`

Acceptance questions:
- Can the customer distinguish sign-in from calendar/provider authorisation?
- Is an existing-account collision explained without silently linking by email?
- Can the customer recover when a provider is unavailable or not configured?
- Does keyboard/focus order remain logical across provider and email controls?

Existing canonical contract: `docs/auth/customer-social-sign-in.md`.

### Journey B — Employee access and permissions

Conceptual flow:

`Employees -> Manage employee -> operational settings -> optional Sign-in access -> role/special permissions where authorised`

Acceptance questions:
- Is the employee represented once regardless of sign-in state?
- Are services/schedule/profile operational controls independent from sign-in where intended?
- Are role and permission controls unavailable or clearly explained when the actor lacks authority?
- Does enabling sign-in avoid creating a duplicate employee?

### Journey C — Routine management navigation

Conceptual flow:

`Dashboard/management shell -> routine task -> canonical workspace -> action/result`

Acceptance questions:
- Can a routine user identify the intended workspace without learning SalonAI internal modules?
- Are legacy aliases absent from ordinary navigation?
- Are unauthorised functions hidden/disabled consistently with route/API enforcement?
- Can advanced tools remain discoverable to authorised users without dominating routine navigation?

This journey drives Stage 1B simple-vs-advanced management presentation.

### Journey D — Permission administration

Conceptual flow:

`Employees / Staff roles -> choose employee/role -> inspect effective capability -> change authorised permission -> confirmation/audit`

Acceptance questions:
- Is the target employee/role unambiguous?
- Can the administrator tell baseline role permission from employee-specific grants?
- Are Super-Admin-only operations visually and server-side protected?
- Is the outcome visible after save without requiring route switching?

## 4. Current information-architecture baseline

The authoritative management route metadata is `frontend/src/components/navigation/managementNavigationConfig.js`.

It currently contains task groups for:

- Salon operations;
- Communications;
- Booking and planning;
- Marketing and growth;
- Performance and reporting;
- Inventory and purchasing;
- SalonAI tools;
- Administration;
- Premium features.

Progressive disclosure limits the initial visible links, but this does not itself create a user-understandable distinction between **routine business work** and **advanced/technical/AI/configuration work**.

### Stage 1B design hypothesis

Introduce one presentation classification in the existing navigation authority:

- **Simple / routine:** high-frequency operational tasks appropriate to the user’s authorised role.
- **Advanced:** infrequent diagnostics, AI/premium analysis, integration/configuration and specialist administration.

Constraints:
- this is presentation only;
- it never changes permission calculation;
- it never grants route/API access;
- search can continue to find every authorised tool;
- direct canonical route access remains governed by existing route/API guards;
- feature flags remain authoritative;
- no second navigation registry is introduced.

This hypothesis must be reviewed before implementation; the exact classification is a product/HCI decision, not a database/schema change.

## 5. Accessibility acceptance baseline

Existing automated public-page Axe coverage is retained.

For representative Stage-1 workflows, acceptance should additionally verify proportionately:

- complete keyboard access to interactive controls;
- visible focus indicator;
- logical tab/focus order;
- no keyboard trap in dialogs/drawers;
- programmatic form labels and useful error association;
- controls have understandable accessible names;
- serious/critical WCAG 2 A/AA and 2.1 A/AA Axe violations are zero on selected flows;
- dialogs/panels remain fully operable within tested desktop and mobile viewports;
- error/success feedback is not conveyed only by colour;
- permission-disabled/hidden states do not leave misleading inert controls;
- route/page title and landmark hierarchy remain understandable.

## 6. Usability evidence baseline

Where a material interaction change is proposed, record:

| Metric | Baseline / target method |
| --- | --- |
| Task completion | Whether representative flow can be completed without hidden/manual workaround |
| Steps | Count meaningful navigation/action steps before vs after |
| Errors | Validation, wrong-route, permission and recovery errors observed |
| Assistance | Whether the user needs technical knowledge or external guidance |
| Responsive fit | Required task remains usable at representative desktop/mobile viewport |
| Accessibility | Keyboard/focus/label/Axe findings |
| Satisfaction/clarity | Short qualitative finding where actual user review is available |

Automated tests are evidence for regressions; they do not replace actual usability review when a material interaction is redesigned.

## 7. Simple vs advanced admin requirements

The Stage-1 implementation should satisfy:

1. Default management navigation emphasises the user’s authorised routine tasks.
2. Advanced mode is opt-in/discoverable and remembered locally only if appropriate; it is not an authority state.
3. Permission filtering occurs before presentation-mode filtering.
4. A Super Admin can still find all governed tools; ordinary delegated users never gain hidden tools by switching modes.
5. Navigation search remains able to locate authorised tools.
6. Compatibility URLs stay redirects, not duplicate menu entries.
7. Feature-disabled tools preserve current feature-control semantics.
8. No new backend permission vocabulary is created solely for Simple/Advanced presentation.
9. Desktop/mobile/collapsed-sidebar behavior remains coherent.
10. Stage 1B receives DEV2 usability/accessibility review and DEV3 permission/completeness review before merge.

## 8. Figma/prototype threshold

Use Figma before substantial React implementation when Stage 1B changes:

- navigation hierarchy significantly;
- employee/role permission interaction;
- authentication/account-linking flow;
- a complex dialog/workspace with multiple conditional states.

A prototype is not mandatory for a narrow source-level fix whose interaction is already established and regression-tested.

When used, compare:

`existing production -> prototype -> implemented React -> production re-test`

Retain the design decision and usability finding with Stage-1 evidence.

## 9. Stage-1 HCI evidence checklist

- [x] Representative users defined.
- [x] Priority Stage-1 journeys identified.
- [x] Existing HCI/accessibility evidence inventoried.
- [x] Simple-vs-advanced design hypothesis documented.
- [x] Accessibility acceptance baseline documented.
- [x] Usability metrics documented.
- [ ] DEV2 review of task groups/classification.
- [ ] DEV3 review of role/permission implications.
- [ ] DEV4 review that presentation classification does not become a tenant-authority shortcut.
- [ ] Stage 1B implementation and browser regression coverage.
- [ ] Production comparison/acceptance after release.

## 10. Evidence update rule

Every Stage-1 PR that materially changes a priority journey must update this file or Issue #253 with:

- the journey changed;
- user problem/evidence;
- design decision;
- affected canonical contracts;
- automated/manual acceptance evidence;
- unresolved usability/accessibility risk.

This prevents later SaaS/vertical customisation from reintroducing interaction problems already solved in SalonAI.