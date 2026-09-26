# DEV2 Roadmap v3.0 — HCI audit and prototype specification

Issue: #277  
Baseline: `main@b14f56e801ee4337cef765f1b40cb0e555ed7217`  
Lane: DEV2 — UI / HCI / accessibility / error quality  
Status: audit/prototype only; no business-rule implementation

Figma prototype file: https://www.figma.com/design/iNumviutWfqBibpl43cKSC

Current Figma frames:
- 01 — Organisation & Location Switcher
- 02 — Location-aware Dashboard
- 03 — Effective Configuration Preview
- 04 — Capability & Entitlement Visibility
- 05 — AI Proposal Review
- 06 — Connector & Integration Health
- 07 — Mobile Location Switcher
- 08 — Mobile AI Proposal Review


## 1. Current-state baseline

The management information architecture already has a useful progressive-disclosure foundation:

- 69 canonical management routes in one registry.
- 24 Simple-mode routes.
- 45 Advanced-mode routes.
- 8 task-oriented sections.
- 34 feature-gated routes.
- 2 routes explicitly marked admin-only in presentation metadata.
- Simple/Advanced mode is presentation-only and does not bypass permission checks.
- Search can discover authorised Advanced tools even while Simple mode is selected.
- Sections preview no more than 5 links before an explicit “show more” action.
- Presentation preference is persisted locally but safely falls back to Simple when storage is unavailable.
- Focus-visible treatment and reduced-motion handling already exist in the management navigation.

This is a strong base. The primary v3.0 HCI risk is not missing navigation; it is enterprise breadth becoming visible faster than users can understand context, authority, location and configuration provenance.

## 2. Complexity budget

These are UX acceptance targets, not security or tenancy rules.

| Measure | Target | Rationale |
| --- | --- | --- |
| Routine task depth | <= 3 deliberate navigation actions from management shell to task start | Keeps daily work fast as locations/capabilities expand |
| Simple-mode section preview | <= 5 visible destinations before expansion | Already established in current navigation |
| Simple-mode visible concepts | Task language only; no tenant/config jargon unless required | Progressive disclosure |
| Location context recognition | Current business/location understandable within 2 seconds without opening a menu | Prevents wrong-location work |
| Location switch | <= 2 actions from any management page | Supports multi-location operation without extra navigation pages |
| Modal/dialog depth | 1 active modal layer; no modal-on-modal workflows | Avoids focus and comprehension failures |
| Minimum pointer target | 44 x 44 CSS px for primary interactive controls on coarse-pointer layouts | WCAG/mobile usability |
| Keyboard operation | All primary flows complete without pointer; focus never lost after close/navigation | Accessibility |
| Horizontal overflow | None at 320 CSS px width for required task content | Mobile baseline |
| Error recovery | Every failed mutation/request presents a recovery action or safe retry path | Operational resilience |
| Destructive/AI consequential action | Explicit review step before commit; outcome remains auditable | Human-in-the-loop |
| Configuration comprehension | Effective value + source/provenance visible together | Prevents hidden inheritance mistakes |
| Capability state comprehension | Distinguish unavailable, disabled, unlicensed and unauthorised | Avoids ambiguous “off” states |

## 3. Current IA audit

### Strengths to preserve

1. **Canonical registry**
   Route, label, permission, feature and presentation metadata are centralised in `managementNavigationConfig.js`. Do not create a parallel location-specific navigation registry.

2. **Task-language grouping**
   Existing sections are phrased around work rather than implementation domains:
   - Run the salon
   - Serve and retain customers
   - Manage the team
   - Manage services, products and stock
   - Communicate and grow
   - Review performance and plan
   - Use AI and automation
   - Configure the business

3. **Simple / Advanced separation**
   Simple mode reduces visible complexity while Advanced remains discoverable. This should become the primary progressive-disclosure mechanism for multi-location/configuration administration.

4. **Authority separated from presentation**
   Current tests explicitly prevent Advanced mode from bypassing permissions. Keep this invariant when location context arrives.

5. **Search as escape hatch**
   Search exposes authorised Advanced tools without forcing a global mode switch. Preserve this behaviour.

### Gaps to solve in prototypes

#### P0 — context safety
There is currently no visible business/location context in the management shell. Once DEV4 introduces trusted membership/location contracts, every management task must make the active context unmistakable.

#### P0 — effective configuration visibility
There is no reusable interaction pattern for:
- effective value;
- inherited-from source;
- locked vs overridable;
- tenant/location override;
- rollback/version history.

DEV4 owns the data contract; DEV2 owns how the user understands it.

#### P1 — capability-state ambiguity
Feature-disabled navigation currently communicates “Currently off”. Future SaaS operation needs four visually distinct states:
- available and enabled;
- available but locally disabled;
- unavailable in current capability pack/entitlement;
- unauthorised for current user.

The frontend must consume authoritative contract state; it must not infer entitlement or permission.

#### P1 — AI proposal review
The existing SalonAI Adviser has good modal/focus/evidence patterns but remains advisory/read-only. Future AI Workforce interactions need a proposal review model rather than direct-write actions.

#### P1 — connector/integration health
Technical health output can become too diagnostic for ordinary operators. Operators need outcome language (“Calendar sync needs attention”), while admins may expand provider details, timestamps and raw diagnostics.

#### P2 — Advanced-mode density
45 Advanced destinations is manageable today because they are sectioned and collapsed, but location/configuration screens could increase density substantially. New enterprise administration should prefer contextual panels inside existing tasks over adding top-level navigation.

## 4. Figma-ready prototype set

These specifications deliberately avoid inventing DEV4 tenancy or DEV3 RBAC semantics.

### Prototype A — organisation/location switcher

**Placement:** management shell header, before task title on desktop; compact context trigger in mobile header.

**Collapsed state**
- Business/organisation name
- Active location name
- compact chevron
- optional status dot only when attention is required

**Open state**
- search field when user has many locations
- current business heading
- permitted locations only
- optional grouped region/zone headings when supplied by DEV4
- “All locations” appears only when authoritative contract permits aggregate context
- recently used locations can be shown as a convenience, never as authority

**Interaction**
1. User opens switcher.
2. Focus moves to search/current-location item.
3. User selects permitted location.
4. Application confirms context change in-page.
5. Focus returns to context trigger.
6. Current page either refreshes in the new context or explains why the task is not available there.

**Error states**
- membership/location no longer available -> fail closed and return to safe context selector
- network error -> current context remains unchanged
- no permitted locations -> explicit support/admin path

### Prototype B — location-aware dashboard context

Add a context strip under the page title:

- **Viewing:** Oxford Street
- timezone/local date when materially different
- small “Change location” action
- optional comparison/aggregate badge when authorised

Dashboard cards should not repeat the location name individually unless a card contains mixed-location data.

For aggregate views, every mixed-location chart/table must label its scope explicitly.

### Prototype C — effective configuration preview

Use an inspectable configuration row/card:

**Primary line**
- setting label
- effective value

**Secondary line**
- source: Platform default / Vertical default / Business / Region / Location
- status: inherited / overridden / locked

**Actions**
- “View source”
- “Override here” only when contract says override is allowed
- “Revert to inherited” only when a local override exists

**Advanced drawer**
- full inheritance chain
- provenance
- version/change actor
- effective date
- rollback/history affordance where supported

Ordinary operators should see only the effective value relevant to their task.

### Prototype D — capability pack / entitlement visibility

On admin configuration surfaces, capability state uses explicit labels:

- **Enabled**
- **Available — off**
- **Not included**
- **No access**

Do not overload disabled styling to represent all four.

For “Not included”, present commercial/admin explanation only to authorised administrators. Ordinary staff simply do not see unavailable functions unless discovery is intentionally required.

### Prototype E — AI Advice Centre / AI Workforce proposal review

Reuse the current Adviser interaction language.

**Proposal card**
- proposed action
- reason
- evidence used
- affected scope/location
- expected effect
- risk/uncertainty
- expiry/validity if applicable

**Decision controls**
- Approve
- Reject
- Edit before approval, only where the future action contract supports bounded edits

**Consequential action flow**
1. AI proposes.
2. Human reviews evidence and affected scope.
3. Human approves/rejects.
4. Server validates current authority/context again.
5. Execution result is shown.
6. Audit/history link is available.

No direct-write autonomous action is implied by the prototype.

### Prototype F — connector/integration health

**Operator view**
- Connected / Attention needed / Disconnected
- last successful sync
- plain-language impact
- retry/reconnect action when permitted

**Admin expansion**
- provider
- account identifier safe for display
- webhook/sync state
- last error
- timestamps
- diagnostic/reference ID

Raw JSON is an admin-only diagnostic disclosure, never the default operator experience.

## 5. Responsive behaviour

### Desktop
- persistent active-location context in shell;
- switcher width capped to avoid displacing task navigation;
- configuration provenance can use two-column detail layout;
- AI proposal review may use side panel or centred dialog, but only one modal layer.

### Mobile
- active location always visible in compact header trigger;
- switcher becomes full-height/bottom-sheet style single dialog;
- 44px minimum interactive targets;
- no horizontal scrolling for configuration chains;
- provenance/history collapses into disclosure sections;
- action bar remains reachable above safe-area inset;
- closing any dialog restores focus to its trigger.

## 6. Accessibility acceptance

- Active business/location is exposed programmatically, not colour-only.
- Context changes announce a concise status update.
- Switcher has an accessible name and keyboard-search flow.
- Dialog focus is trapped only while open and restored on close.
- Permission/entitlement/disabled distinctions include text, not icon/colour alone.
- All form errors associate with their controls and offer recovery guidance.
- Configuration inheritance diagram has an equivalent textual reading order.
- AI proposal evidence and uncertainty are accessible without hover.
- Reduced-motion preference removes non-essential location/context transitions.
- High-density Advanced screens maintain normal-text contrast and visible focus.

## 7. Prototype evaluation tasks

Use these tasks during Figma/usability evaluation:

1. Receptionist switches from one permitted location to another and opens today’s appointments.
2. Manager identifies why a booking policy has a particular effective value.
3. Admin discovers that a capability is not included rather than merely switched off.
4. Super Admin reviews an AI proposal affecting one location and rejects it after inspecting evidence.
5. Operator identifies a failed calendar connector and understands the customer/staff impact.
6. Keyboard-only user completes location switch and returns focus to the originating context trigger.
7. Mobile user performs the same location switch at 320–390px width without horizontal overflow.

## 8. Dependency map

- **DEV4 #279:** authoritative BusinessMembership, Location, hierarchy and configuration-inheritance contracts.
- **DEV3 #278:** effective permission/location-scope semantics and administrative permission inspection.
- **DEV1 #236 / later integration:** integration/release and Stage 3 compatibility.
- **#280:** reconciliation authority for cross-workstream decisions.

DEV2 must not implement placeholder tenant IDs, client-authoritative location scope, or invented permission semantics while those contracts are pending.

## 9. Recommended implementation order after contract approval

1. Shell location-context component.
2. Dashboard context strip.
3. Effective configuration row + provenance drawer.
4. Capability-state component.
5. Connector-health summary/detail pattern.
6. AI proposal-review pattern.
7. Cross-device/accessibility regression suite.

Until DEV4/DEV3 contracts are stable, this document remains a prototype specification only.
