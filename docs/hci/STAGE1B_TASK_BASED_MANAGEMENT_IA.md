# Stage 1B — Task-based Management Information Architecture

**Roadmap:** AI Intelligent Business Platform v2.9  
**Reference vertical:** SalonAI  
**Issue:** #253  
**Implementation owner:** Developer 1  
**Review lanes:** Developer 2 HCI/accessibility; Developer 3 RBAC/staff; Developer 4 tenant-boundary

## 1. Decision

SalonAI now uses one canonical management-navigation registry with two presentation levels:

- **Simple** — default view for routine operational work;
- **Advanced** — opt-in view that adds specialist analysis, AI, premium, governance and configuration tools already authorised for the signed-in user.

This is progressive disclosure, not access control. The same canonical routes, route guards, feature controls and server-side RBAC remain authoritative.

## 2. Research basis

The implementation uses the Stage-1 task analysis in `STAGE1_HCI_BASELINE.md` and the following external guidance:

1. **WCAG 2.2 — 3.2.3 Consistent Navigation (AA):** repeated navigation mechanisms should remain in the same relative order unless the user initiates the change. Simple/Advanced therefore changes visibility through an explicit user control; it does not create a second navigation tree.
2. **WCAG 2.2 — 2.4.11 Focus Not Obscured (Minimum) (AA):** keyboard-focused controls must not become entirely hidden by author-created content.
3. **WCAG 2.2 — 2.5.8 Target Size (Minimum) (AA):** pointer targets should be at least 24 x 24 CSS pixels or satisfy the spacing exception. The view controls use a 36px minimum height, increased to 40px on small viewports.
4. **WAI-ARIA APG — Disclosure Navigation:** ordinary application/site navigation should generally remain semantic navigation links plus disclosure controls rather than adopting `menu`/`menubar` roles that imply desktop-menu keyboard behaviour.
5. **Nielsen Norman Group — Progressive Disclosure:** primary displays should emphasise frequent/core tasks and disclose specialised features on request. The secondary level must be clearly labelled and should not remove discoverability.

References:
- https://www.w3.org/WAI/WCAG22/quickref/#consistent-navigation
- https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/
- https://www.nngroup.com/articles/progressive-disclosure/

## 3. Current task analysis applied to navigation

The previous registry mixed user tasks with product/module boundaries such as Communications, Booking and planning, SalonAI tools and Premium features. Stage 1B replaces those navigation headings with task-oriented groups while preserving all canonical route records:

| Task group | Routine intent | Advanced additions |
| --- | --- | --- |
| Run the salon | dashboard, appointments, calendar, waitlist, daily close | demand/loss analysis, smart appointments, capacity, dynamic pricing |
| Serve and retain customers | customer records, follow-ups, retention actions | segmentation, value/risk analysis, rebooking, experience, loyalty/gift/referral tools |
| Manage the team | own/team availability, employees, public profiles, rota | role administration and staff performance |
| Manage services, products and stock | services, products, inventory, orders, suppliers, purchase orders | reorder/stock forecasting, service analysis, imports |
| Communicate and grow | communication history, templates, scheduled messages | campaigns, delivery diagnostics, attribution and channel/premium automation |
| Review performance and plan | reports | forecasting, feedback/executive analytics, export audit and premium analytics |
| Use AI and automation | none in Simple by design | AI recommendations, summaries, segmentation, forecasting, prediction and copilot |
| Configure the business | none in Simple by design | admin overview and feature controls |

The registry contains **67 unique canonical management routes**: **23 routine** and **44 advanced**. For a Super Admin before role filtering, Simple therefore removes 44 specialist entries from the default scan path (about 66% of the full catalogue) while Advanced restores the complete authorised catalogue.

Role/permission and feature filtering usually reduce the visible set further for delegated users.

## 4. Authority and filtering order

The implementation order is deliberate:

1. canonical registry metadata;
2. actor role/permission checks;
3. profile-scope checks;
4. feature-control state;
5. Simple/Advanced presentation filtering;
6. search and progressive section disclosure.

Consequences:

- switching to Advanced cannot add a permission;
- Super Admin remains the only unconditional management-permission bypass through the existing `hasFullManagementDashboard()` contract;
- Admin, Manager, Receptionist and Stylist remain permission-controlled;
- a disabled feature remains disabled in either presentation;
- direct routes still use the existing route/API guards;
- customer/social-auth and staff-calendar OAuth boundaries are unchanged.

## 5. Discoverability model

Simple is the default, but it does not make authorised specialist tools undiscoverable:

- the Simple/Advanced switch is visible when the actor has at least one authorised advanced tool;
- search intentionally searches all authorised links even while Simple is selected;
- advanced search results are labelled **Advanced**;
- Advanced mode is stored only as a local UI preference under `salonai.managementNavigation.presentation.v1`;
- storage failure falls back to Simple without breaking navigation;
- changing view resets temporary section collapsed/expanded state so the new information hierarchy is predictable.

## 6. Accessibility implementation

The management navigation now uses:

- a named `<nav aria-label="Management workspaces">` landmark;
- native buttons for Simple/Advanced and disclosure controls;
- `aria-pressed` for the two presentation choices;
- `aria-expanded` plus `aria-controls` for section disclosure;
- a labelled native `type="search"` input;
- text labels for Advanced status instead of colour-only signalling;
- explicit visible `:focus-visible` outlines;
- 36px minimum view-control height, 40px on small viewports;
- existing NavLink semantics rather than ARIA `menu` roles;
- reduced-motion handling for management-navigation transitions.

These changes complement rather than replace the existing Playwright/Axe acceptance suite.

## 7. Automated acceptance evidence

`frontend/src/test/ManagementNavigationPresentation.test.jsx` verifies:

- all 67 route records remain unique and classified;
- Simple is the default and omits specialist AI tools;
- Advanced reveals authorised specialist tools;
- the preference is persisted and restored;
- Simple-mode search still discovers authorised Advanced tools;
- delegated users do not gain AI/Admin tools by switching to Advanced.

Existing management regression tests continue to protect canonical redirects, the single navigation source, progressive section disclosure, route/bundle budgets and viewport-safe management dialogs.

## 8. Review checklist

### DEV2 — HCI/accessibility
- [ ] Check task-group labels against representative salon/reception/admin terminology.
- [ ] Keyboard-only pass through view switch, search, section disclosure and links.
- [ ] Confirm focus visibility/viewport fit on desktop and representative mobile viewport.
- [ ] Confirm Advanced badges and disabled states are understandable without colour.

### DEV3 — RBAC/staff
- [ ] Confirm each task remains mapped to the same canonical permission.
- [ ] Confirm Super Admin remains sole full-dashboard bypass.
- [ ] Confirm Admin/Manager/Receptionist/Stylist cannot reveal unauthorised routes via Advanced/search.
- [ ] Confirm staff-profile own/all scope behaviour remains correct.

### DEV4 — platform boundary
- [ ] Confirm `presentation` remains UI metadata only and is not reused as a tenant entitlement or authority claim.
- [ ] Confirm future vertical configuration can map task labels without duplicating core route/permission logic.

## 9. Remaining Stage-1 acceptance

Stage 1B is code-complete when CI/build/component tests pass and the above reviews are resolved. Stage 1C then extends browser HCI/accessibility evidence; Stage 1D performs provider-backed customer social-auth acceptance when production credentials/configuration are available. No provider credentials are added to source control.
