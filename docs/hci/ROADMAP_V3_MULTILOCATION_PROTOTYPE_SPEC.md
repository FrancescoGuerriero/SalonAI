# Roadmap v3.0 — Multi-Location Prototype Specification

Owner: DEV2  
Issue: #277  
Companion: `ROADMAP_V3_MULTILOCATION_COMPLEXITY_BUDGET.md`

## Purpose

Translate the v3.0 multi-location/HCI requirements into implementation-ready interaction patterns before frontend code changes begin.

These flows are presentation contracts only. DEV4 owns tenancy/configuration contracts and DEV3 owns RBAC semantics.

## 1. Persistent business/location context

### Desktop
Place a compact context control in the persistent management shell near the primary navigation header.

Display:
- active business;
- active location;
- optional scope indicator: `All authorised locations` or one location;
- clear affordance to change location.

Do not hide the current context inside a settings page.

### Mobile
Use a compact current-location chip in the top bar. Opening it launches a full-height bottom sheet rather than a narrow popover.

### Context-switch safeguards
When unsaved state exists:
1. user selects another location;
2. app detects unsaved changes;
3. show choices: stay / discard and switch;
4. never silently change context.

If the selected location is no longer authorised, show a neutral access message and return to the first valid context without exposing the removed location's data.

## 2. Location switcher

Required states:
- one available location: show current location; no unnecessary selector interaction;
- multiple authorised locations: searchable list;
- business-wide role with all-location reporting: optional `All locations` analytical context;
- suspended/inactive location: disabled with reason if user is permitted to know it;
- no authorised locations: explicit access-empty state, not an empty dashboard.

Each option displays only:
- name;
- optional city/region;
- status if relevant.

Do not show tenant IDs, internal database IDs or raw hierarchy keys.

## 3. Effective configuration inspector

For every configurable field display:
- effective value;
- source scope, e.g. Platform / Salon AI / Business / Location;
- state: inherited / overridden / locked / unavailable by plan;
- last revision metadata where available.

Recommended row pattern:

`Booking lead time   30 min   Business override`

Secondary disclosure:
`Inherited Salon AI default: 45 min`

For locked values:
`Online security control   Enabled   Locked by Platform`

Do not render a disabled input without explaining why it is disabled.

## 4. Location override workflow

1. Open setting.
2. Show effective value and inheritance source.
3. User chooses `Override for this location`.
4. Editable field appears.
5. Preview explains:
   - old effective value;
   - new value;
   - affected location;
   - whether lower scopes inherit it.
6. Material changes require explicit confirmation.
7. Successful save shows revision/audit confirmation.
8. `Revert to inherited value` removes the local override rather than copying the parent value.

## 5. Capability / entitlement unavailable state

Differentiate:
- permission denied;
- plan/capability unavailable;
- parent configuration disabled;
- platform safety lock;
- provider integration unavailable.

Never use one generic `Disabled` state for all five.

Preferred explanation format:

`AI Workforce is not enabled for this plan.`

or

`This setting is locked by the platform security policy.`

No upgrade CTA is shown unless commercial entitlement data explicitly permits it.

## 6. AI Advice Centre / action proposal

Proposal card must expose:
- proposed action;
- affected domain;
- target record(s);
- business/location context;
- evidence/rationale;
- model/agent identity where appropriate;
- required permission;
- expiry;
- approval state;
- execution state;
- audit trail link.

Actions:
- approve;
- reject;
- edit-and-approve only if the action contract explicitly supports editable parameters;
- inspect evidence.

High-impact actions must not use a one-click destructive confirmation.

## 7. Connector health

Each connector row:
- provider;
- enabled/disabled;
- last successful sync;
- current health;
- latest safe error classification;
- next allowed recovery action.

Do not expose secrets or raw provider credentials.

## 8. Navigation rule

The management shell should remain task-oriented.

Primary navigation should represent tasks such as:
- Appointments
- Customers
- Team
- Services
- Inventory
- Communications
- Reports
- AI
- Settings

Tenant architecture concepts such as Brand, Zone, Entitlement or ConfigScope should appear only where administratively necessary.

## 9. Prototype acceptance matrix

| Flow | Desktop | Mobile/narrow | Keyboard | Empty state | Error state | Permission state |
| --- | --- | --- | --- | --- | --- | --- |
| Context switch | required | required | required | required | required | required |
| Config inspector | required | required | required | n/a | required | required |
| Override setting | required | required | required | n/a | required | required |
| AI proposal review | required | required | required | required | required | required |
| Connector health | required | required | required | required | required | required |

## 10. Implementation gate

No multi-location frontend implementation should begin until:
- DEV4 freezes the first BusinessMembership/Location/configuration response shapes;
- DEV3 confirms location-scope semantics;
- this prototype is reviewed against the complexity budget;
- no duplicate dashboard/settings surface is introduced.
