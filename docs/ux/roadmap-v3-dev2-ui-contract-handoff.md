# DEV2 Roadmap v3.0 — UI contract handoff

Issue: #277  
Figma: https://www.figma.com/design/iNumviutWfqBibpl43cKSC  
Purpose: define the presentation data DEV2 needs from trusted backend contracts without creating tenancy, RBAC or entitlement authority in the frontend.

## Contract principle

DEV2 components render authoritative state supplied by the application/backend. They do not infer:
- which business a user belongs to;
- which locations a user may access;
- whether aggregate/all-location scope is allowed;
- which permissions a user has;
- whether a capability is licensed/included;
- whether configuration may be overridden;
- whether an AI proposal may be executed.

All identifiers below are opaque frontend values. Server-side authority remains mandatory.

## 1. LocationContext

Figma component: `LocationContext`

Presentation states:
- `default`
- `open`
- `loading`
- `error`

Suggested data shape:

```js
{
  business: {
    id: "opaque-business-id",
    name: "AI Business Platform"
  },
  activeLocation: {
    id: "opaque-location-id",
    name: "Marylebone",
    subtitle: "London"
  },
  permittedLocations: [
    {
      id: "opaque-location-id",
      name: "Marylebone",
      subtitle: "London"
    }
  ],
  canUseAggregateScope: false,
  loading: false,
  error: null
}
```

Authority:
- DEV4 #279 resolves business membership and permitted locations.
- DEV3 #278 may further constrain the available location scope by effective authority.
- DEV2 only renders values returned by the trusted contract.

Required behaviour:
- switching context must never rely on a client-provided location id alone;
- failed context change retains the last safe context;
- no permitted location -> fail closed to safe recovery state;
- aggregate scope appears only when explicitly authorised.

## 2. Location-aware dashboard scope

Suggested data shape:

```js
{
  scope: {
    type: "location",
    locationId: "opaque-location-id",
    label: "Marylebone",
    timezone: "Europe/London"
  },
  aggregate: false
}
```

Rules:
- every mixed-location metric must declare its scope;
- location-specific pages inherit the active trusted scope;
- frontend labels must not imply aggregate authority when `aggregate === false`.

## 3. EffectiveConfiguration

Figma pattern: configuration row + provenance drawer.

Suggested data shape:

```js
{
  key: "booking.depositPercentage",
  label: "Deposit required",
  effectiveValue: 25,
  displayValue: "25%",
  source: {
    level: "location",
    label: "Marylebone"
  },
  inherited: false,
  locked: false,
  canOverride: true,
  canRevert: true,
  inheritanceChain: [
    { level: "platform", displayValue: "0%" },
    { level: "vertical", displayValue: "10%" },
    { level: "business", displayValue: "20%" },
    { level: "location", displayValue: "25%" }
  ]
}
```

Authority:
- DEV4 defines inheritance, lock, provenance, versioning and override semantics.
- DEV2 renders the effective value and provenance.
- DEV2 must not calculate the effective value client-side from independent fragments.

## 4. CapabilityStatus

Figma component: `CapabilityStatus`

Allowed presentation states:
- `enabled`
- `off`
- `not-included`
- `no-access`

Suggested data shape:

```js
{
  capabilityId: "advanced-analytics",
  label: "Advanced analytics",
  state: "off",
  reason: "Included but disabled for this business",
  canChangeState: true
}
```

Meaning:
- `enabled`: included, authorised and switched on;
- `off`: included/authorised but locally disabled;
- `not-included`: entitlement/capability pack does not include it;
- `no-access`: capability may exist but the current account is not authorised.

The frontend must not collapse these states into one disabled appearance.

Authority:
- DEV4 supplies entitlement/capability-pack state.
- DEV3 supplies effective authority where applicable.
- DEV2 supplies only visual treatment and task wording.

## 5. AIProposalDecision

Figma component: `AIProposalDecision`

Presentation states:
- `review`
- `approved`
- `rejected`
- `expired`

Suggested data shape:

```js
{
  proposalId: "opaque-proposal-id",
  state: "review",
  title: "Open two additional colour appointments",
  reason: "Forecast capacity shortfall",
  scope: {
    type: "location",
    label: "Marylebone"
  },
  expectedEffect: "+2 appointment slots",
  uncertainty: "moderate",
  evidence: [
    { label: "Booking demand", period: "8 weeks" },
    { label: "Staff capacity", period: "current rota" }
  ],
  canApprove: true,
  canReject: true,
  expiresAt: "ISO-8601"
}
```

Rules:
- UI approval is a request to the authoritative server, not execution authority;
- server must revalidate user authority and current context at decision time;
- stale/expired proposals must fail closed;
- approved/rejected state includes audit/outcome evidence where available;
- DEV2 does not implement direct-write autonomous AI behaviour.

## 6. ConnectorHealth

Figma component: `ConnectorHealth`

Presentation states:
- `connected`
- `attention`
- `reconnecting`
- `disconnected`

Suggested data shape:

```js
{
  connectorId: "microsoft-outlook",
  label: "Microsoft Outlook",
  state: "attention",
  summary: "2 staff calendars need reconnect",
  impact: "Appointments still work; two external calendars are not receiving updates.",
  lastSuccessfulSyncAt: "ISO-8601",
  affectedCount: 2,
  referenceId: "CAL-2091",
  canReconnect: true,
  canViewDiagnostics: true
}
```

Rules:
- operator view leads with user/business impact;
- raw/provider diagnostics remain an authorised admin disclosure;
- connection health must not be inferred from frontend polling heuristics when a canonical backend status exists.

## 7. Error/loading/empty requirements

Every contract-backed component must support:
- loading;
- safe empty state;
- recoverable request failure;
- authority/context invalidation;
- stale-data refresh;
- explicit retry where retry is safe.

A failed mutation must never silently fall back to a visually successful state.

## 8. Accessibility contract

UI consumers must preserve:
- accessible names for location/context triggers;
- visible keyboard focus;
- 44x44 CSS px target size for primary coarse-pointer actions;
- focus restoration after dialogs/sheets close;
- text labels for capability/connector states, not colour-only meaning;
- live-region announcement for context change success/failure;
- no modal-on-modal interaction;
- no required horizontal scroll at 320 CSS px.

## 9. React component direction

Target presentation components after backend contracts stabilise:

```jsx
<LocationContext
  business={business}
  activeLocation={activeLocation}
  permittedLocations={permittedLocations}
  canUseAggregateScope={canUseAggregateScope}
  onRequestChange={requestLocationChange}
/>

<EffectiveConfigurationRow
  setting={setting}
  onRequestOverride={requestOverride}
  onRequestRevert={requestRevert}
/>

<CapabilityStatus capability={capability} />

<AIProposalReview
  proposal={proposal}
  onRequestApprove={requestApprove}
  onRequestReject={requestReject}
/>

<ConnectorHealth
  connector={connector}
  onRequestReconnect={requestReconnect}
/>
```

The `onRequest*` naming is intentional: frontend actions request authoritative server operations; they do not grant authority themselves.

## 10. Dependency gate

Implementation into production React should begin only when:
1. DEV4 #279 exposes stable trusted membership/location/configuration contracts for the relevant component;
2. DEV3 #278 exposes effective location-aware authority for the relevant management action;
3. DEV1 confirms integration timing;
4. DEV2 accessibility/responsive acceptance criteria remain satisfied.

Presentation-only component scaffolding may be created earlier if it contains no placeholder authority logic.
