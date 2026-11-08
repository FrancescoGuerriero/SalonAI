# AIIBP v3 — Canonical Module Catalogue & Taxonomy (DEV1)

Source specification: `03_module_catalogue.md` supplied for this development task.

## Scope delivered

The read-only `backend/src/platform/moduleCatalogue/canonicalModuleCatalogue.js`
provides a **taxonomy and requirements projection**, not an alternative
product or entitlement registry.

- Preserves requirement IDs **01–27**, in their original order.
- Preserves the fifteen named catalogue categories.
- Preserves 21 additional `CORE-*`, `AI-CORE-*`, `MKT-*`, `FIN-01`,
  `DATA-01`, `FUL-01`, and `VERT-*` candidate IDs.
- Records source planning status, P0–P3 priority, original source class and
  AI opportunity, with DEV1 as sole development owner.
- Uses existing **capability pack keys** only where the mapping is direct and
  registered. Unknown mappings deliberately remain empty rather than
  registering fictional capabilities or granting entitlements.
- Marks requirement **22** as a research placeholder and **26** as a
  taxonomy refactor, not separate deployable modules.
- The proposed `VERT-02` is a future tenant/vertical candidate, **not**
  a registered or provisioned vertical.

## Required catalogue contract

Each entry exposes:

`moduleId`, `displayName`, `category`, `owner`, `lifecycle`,
`sourceStatus`, `deploymentStatus`, `productionAcceptance`, `version`,
`dependencies`, `entitlementKey`, `scopeClass`, `permissions`,
`apiCapabilities`, `aiToolRefs`, `verticalCompatibility`,
`providerReadiness`, `evidenceLinks`, and `lastReviewedAt`.

`scopeClass`, API references, provider verification and production acceptance
remain explicitly unverified rather than guessed. Mapped dependencies,
permissions and vertical compatibility come from the authoritative
capability registry. A candidate record's presence never enables a pack.

## Independent acceptance axes

`inspectModuleCatalogueStatus` distinguishes:

1. Catalogue visibility
2. Canonical capability registration
3. Entitlement evidence
4. Configuration evidence
5. Provider-verification evidence
6. Ingestion/operation evidence
7. Production-acceptance evidence

Each absent evidence signal returns `null` or `unknown`, **never
implicitly true**. Entitlement requires backend-trusted entitlement evidence;
an enabled composition alone does not prove entitlement. The projection always
returns `activationAuthorised: false` and must **never** be consulted as an
authorisation decision. Existing tenant product composition, subscription,
permission, feature and deployment authorities remain the sole operational
gates.

## Roadmap statuses and verification

The uploaded roadmap says PR #586 is active/unmerged. That is **historical
planning status**, not current verification. This record explicitly labels it
a roadmap snapshot. Before changing live `sourceStatus` or
`productionAcceptance`, DEV1 must inspect current GitHub, CI/deployments,
runtime, and provider acceptance separately; a merged PR alone is never
proof of production acceptance.

The catalogue source is frozen to preserve the supplied specification.
Follow-up development can implement an authenticated management-only status
view, linked evidence records and module-level acceptance checks without
coupling business enablement to the catalogue itself.

## Explicit exclusions

This change does not add 27 new modules, register unimplemented capabilities,
change entitlements or subscriptions, introduce monthly AI quotas, connect
providers, expose an API route, or deploy/activate production features.

Sole development owner: **DEV1**.

## DEV1 priority-first delivery-gap assessment (2026-11-08)

The existing read-only, membership-protected
`GET /system-administration/module-catalogue/operational-acceptance`
response now includes `assessment.deliveryGaps`. It derives only from the
server's previously verified tenant manifest/subscription evidence and the
existing twelve-prerequisite assessment for each entry. It reports:

- **48 entries**: 27 roadmap requirements and 21 candidates, with their
  original identifiers, categories, priority and AI opportunities preserved.
- Per-entry **confirmed prerequisite blockers** only when an existing check
  returns `failed_or_missing`; unavailable checks remain
  `not_verified`, never silently treated as failed or passed.
- P0/P1/P2/P3 and category-level counts, including unmapped/taxonomy items,
  to prioritise technical follow-up without changing the underlying roadmap.
- A read-only management dashboard summary; no new write endpoint, plan,
  subscription, capability registration or deployment operation.

The result is **not** a production-readiness score: existing deployment,
runtime, cross-module behaviour, provider verification and sign-off remain
independent evidence requirements. `activationAuthorised` is always false,
and `productionAcceptedCount` is null because tenant-wide production
acceptance was not independently inspected. The existing authoritative
platform capability registry and tenant entitlements remain unchanged.

Commerce/Stripe draft PR #608 remains separate and is not part of this
Module Catalogue slice. No monthly AI usage quotas are introduced.
