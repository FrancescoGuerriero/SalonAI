# Roadmap v3.0 — Figma multi-location prototype evidence

Owner: DEV2  
Issue: #277  
Figma file: https://www.figma.com/design/roTSaBJuQTYNJpBInNahXQ

## Prototype scope

The Figma prototype operationalises the Roadmap v3.0 HCI/complexity-budget work for four management flows:

1. **Location Context**
   - persistent active business/location context;
   - authorised location switcher;
   - business-wide reporting context;
   - no client-selected location is presented as authority.

2. **Effective Configuration**
   - effective value;
   - provenance/source scope;
   - inherited, locked, entitlement and location-override states;
   - explicit override and preview actions;
   - inheritance path from platform -> vertical -> business -> location.

3. **AI Advice Centre**
   - governed action proposal;
   - business/location context;
   - permission requirement;
   - evidence and rationale;
   - proposed action;
   - approve, reject and audit-trail actions;
   - proposal remains separate from execution.

4. **Connector Health**
   - provider state;
   - safe last-sync/readiness evidence;
   - recovery action where applicable;
   - provider-neutral business-rule boundary.

## Visual source of truth

The prototype follows the current SalonAI frontend source rather than a generic community UI kit:

- Inter typography;
- cream/white/grey surfaces;
- gold accent hierarchy;
- compact management density;
- reduced corner radii;
- task-oriented navigation.

## Figma foundation

The file contains:
- 3 local variable collections;
- 34 variables;
- 8 Inter text styles;
- 2 shadow styles;
- reusable Button component set with Primary and Secondary variants;
- 4 desktop prototype screens.

## QA evidence

Final prototype audit:
- 4 expected screen frames present;
- 146 text nodes;
- all text uses Inter;
- zero unbound visible solid fills/strokes;
- 6 reusable Button instances;
- generic internal frame names removed;
- visual clipping found during review was corrected before handoff.

## Implementation boundary

The prototype does **not** grant tenancy or RBAC authority in the frontend.

Implementation must consume:
- DEV4 BusinessMembership / Location / trusted tenant-context contracts;
- DEV3 effective permission and route/location-scope matrix;
- existing server-side permission middleware.

The location selector remains a selector only:

`client selection != authorization`

## Handoff

DEV1/DEV4 may implement these UI patterns only after the corresponding backend contracts are stable. No duplicate settings, tenancy, permission or AI-execution authority should be created in frontend code.
