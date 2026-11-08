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

## DEV1 tenant dependency-prerequisite diagnostics

The existing operational-acceptance response now includes
`entries[].dependencyEvidence`, with each canonical capability prerequisite
and its manifest-selection, subscription-entitlement and lifecycle evidence
derived from the already trusted, all-location tenant inspector.

- `prerequisites_evidenced` means the corresponding tenant records agree
  on composition, entitlement and active/trial lifecycle; it **does not**
  confirm runtime operation, provider access, permission tests or production sign-off.
- `confirmed_prerequisite_blocker` means a trusted source explicitly
  denies selection/entitlement or records an ineligible subscription lifecycle.
- `not_verified` means evidence is absent, incomplete or contradictory.
  It never means a module is broken or ready to deploy.

The P0–P3 summary also includes per-module dependency prerequisite blockers
and unresolved dependency verification keys. The dashboard presents this
information without creating activation controls or altering module contracts.
Existing `dependency_acceptance` checks remain `not_verified`, because
commercial prerequisites are distinct from end-to-end workflow acceptance.

## DEV1 capability mapping and AI tool-evidence review queue

The existing read-only tenant acceptance summary now separates three
different catalogue meanings:

- `canonical_mapping_recorded`: a module requirement references one or more
  registered canonical capability packs. **Not** evidence of deployment.
- `mapping_review_required`: a planned requirement/candidate has no
  independently mapped canonical capability pack. It stays unregistered.
- `taxonomy_only`: an intentional structural/research entry, currently
  requirement 22 or 26, **not** a missing deployable module.

Entries with specified `aiOpportunity` are also labelled
`tool_contract_not_verified` until separately reviewed evidence can attest
to governed AI tools. This does **not** mean the existing AI implementation
is missing or that a proposed AI feature is deployable. Entries without an
AI opportunity are labelled `ai_integration_not_specified`.

The `deliveryGaps.reviewQueue` is priority-ordered using the existing
P0–P3 planning priority and selects **only** entries needing capability
mapping review or with confirmed prerequisite blockers. It never assigns
runtime status, writes entitlements, creates modules or authorises
activation. The dashboard renders the queue and shows mapping, taxonomy
and unverified AI opportunity counts separately. No monthly AI quotas.

## DEV1 canonical API and AI integration contract declarations

The existing tenant-protected operational acceptance response includes
`entries[].contractEvidence`. It inventories **only** declarations already
present in the canonical capability registry: `integrationContracts`,
`configurationDefinitions`, `requiredPermissions`, and registered
capability keys. No API route or AI agent is inferred from a module title or
roadmap opportunity.

`integration_contracts_declared` is a source-definition observation, not
endpoint validation. `integration_contracts_not_declared` does not mean
that APIs or AI capabilities are absent. `capability_mapping_missing`
means that this planning entry has no mapped pack, not that the underlying
implementation is missing. All route, provider, operational, AI tool and
production acceptance states remain `not_verified`.

The read-only management dashboard exposes the declaration inventory per
module. No actual endpoint is executed or provider credential consulted; no
deployment, entitlement or catalogue activation is implied. In particular,
this does not create or replace existing Stripe, booking or AI integrations.

## DEV1 reviewed API/AI source-work traceability

The existing operational acceptance `contractEvidence.relatedSourceReviews`
now links module requirements to PRs in the **previously reviewed,
immutable Module Delivery Evidence Ledger**. This adds source provenance
without live external calls or client-supplied URLs. Each related record
includes a PR number, GitHub source URL, type, reviewed date and
`related_work_merged` outcome; it is *not* an assertion that a particular
API route, AI tool or full module has been delivered.

The summary counts entries with source reviews separately from entries
with registered integration declarations. Both can be present while
`apiRouteVerification`, `apiOperationalAcceptance`,
`aiToolContractVerification` and provider readiness all remain
`not_verified`. Source review records must be refreshed independently
after inspecting the exact PR and associated checks. A snapshot does not
replace a live tenant-specific API acceptance test, signed deployment
identity or explicit production sign-off. No module activation is added.

## DEV1 module-specific API/RBAC/AI acceptance contracts

The protected operational-acceptance response now contains
`entries[].acceptanceContract` for every requirement and candidate.
Contracts distinguish registered mapped capabilities from unmapped
planning requirements and taxonomy-only entries. They provide a
**verification checklist, not claims of implemented endpoints**:

- Authenticated route inventory and positive/negative effective-permission
  tests, with explicit foreign-Business and unauthorised-Location rejection.
- Subscription/feature and dependency workflow acceptance.
- Governed AI tool registry binding, tenant/permission enforcement, approval
  and audit (where applicable), and negative/failure/prompt-injection tests
  for entries with AI opportunities.
- Provider/contract tests only where canonical registered integration
  declarations exist, plus runtime identity and production sign-off.

The API route inventory and AI tool bindings are explicitly **not verified**;
the catalogue never fabricates endpoint paths, overrides RBAC, enables
capabilities, or claims a completed production sign-off. This is a
prioritisation/acceptance contract for DEV1 to fill with independently
reviewed module-specific test evidence. Source/CI snapshots alone do not
satisfy this contract.

## DEV1 P0 acceptance test-source cross-reference

The existing protected Module Catalogue assessment now returns
`reviewedTestSourceEvidence` per entry, sourced from the immutable
`moduleTestEvidenceLedger.js`. Source inspection on 2026-11-08 mapped
the existing catalogue and AI test suites to P0 capabilities:

- `CORE-02`: canonical catalogue, trusted tenant evidence, module
  operational checklist and backend runtime identity tests.
- `16`, `18`, `AI-CORE-01`, `AI-CORE-02`: governed read-only AI metrics
  invocation tests, including foreign tenant/location denials and
  error/audit behaviour, and AI Adviser route/tool boundary tests where mapped.

These links are **reviewed test-file source evidence**, not per-test
execution attestations. Recorded workflow green states cover a commit's
workflow result; individual tests were not independently reconciled with
CI job logs in this slice. The ledger explicitly returns
`executedInThisInspection: false`, `perTestCiConclusion: null`,
`tenantAcceptance: null` and `productionAccepted: null`.
A module with no listed test has no reviewed mapping **in this ledger**;
that does not imply the repository contains no tests for that module.

This slice does not modify acceptance thresholds, activate packs,
change production infrastructure, or introduce subscription/AI quotas.

## DEV1 additional P0 reviewed test-source links

Source inspection extended the immutable test-source ledger to:
- `CORE-01`: BusinessMembership, trusted-tenant and selected-location control-plane tests.
- `11` / `CORE-03`: integration registry and credential/scoping tests.
- `CORE-04`: available tenant policy/configuration, integration authorization and AI audit-reconciliation tests; **not** a claim that all secrets, events and policies have complete test coverage.
- `AI-CORE-01` / `AI-CORE-02`: AI Workforce agent/tool ceilings, governance and run-audit tests.
- `AI-CORE-04`: bounded AI reads, timeout/cancellation and audit failure classification; this does **not** prove complete model gateway, costing or safety functionality.
- `AI-CORE-05`: AI human approval, proposal mutation prohibitions and audit reconciliation tests.

The reviewed test-source inventory is intentionally partial, with no inferred
absence of unlisted tests. Each reference records a source-level contract;
per-test execution verification, all-location tenant acceptance, production
approval, AI external-provider availability and deployment remain unverified.
No capability pack or production configuration was changed.

## DEV1 existing P1 business module implementation references

The Module Catalogue now explicitly recognises the **existing implementation**
of the following modules without adding duplicate registration, endpoint,
entity, subscription or business logic:

| Requirement | Existing implementation source | Observed API mount |
| --- | --- | --- |
| 01 Appointments & Booking | `routes/appointmentRoutes.js` and `features/appointments/appointmentManagementRoutes.js` | `/api/appointments` |
| 02 Workforce & Staff | `routes/stylistRoutes.js` | `/api/stylists` |
| 03 Service Catalogue | `routes/serviceRoutes.js` | `/api/services` |
| 04 Commerce | `features/commerce/commerceRoutes.js` | `/api/commerce` |
| 09 Communications | `routes/communicationTemplateRoutes.js`, `routes/communicationCampaignRoutes.js`, `routes/messageDeliveryRoutes.js` | `/api/communication-templates`, `/api/communication-campaigns`, `/api/message-delivery` |

These are **source-level references to pre-existing modules**, not newly
built modules or an exhaustive route inventory. The read-only
`implementationReference` response carries the observed source files
and mounts, never replacing the existing route implementations. The
acceptance checklist remains independent: a source file existing is not
evidence that every tenant boundary, provider, payment flow, and live
deployment acceptance test has passed. Unreviewed entries are marked
`not_reviewed_in_this_inventory`, not `not_implemented`.

The prior P0 ledger expansion exposed two outdated tests that assumed
Integration Hub (11) had no mapped test source and that the ledger only
contained its earlier P0 IDs. Those assertions were corrected after
inspecting the failed Stage 1–6 job, without weakening tenant or
permission tests. This change preserves Commerce and Stripe behaviour.

## DEV1 broader catalogue mapping of existing module sources

Additional inspected references reuse the application's actual Express mounts,
including nested `/api/future` routing. These records recognise existing
source, **not** newly generated or fully production-accepted modules:

| Catalogue ID | Existing source surface | Mounted API |
| --- | --- | --- |
| 05 E-commerce & Online Store | Commerce product/storefront routes | `/api/commerce` |
| 06 Memberships | Membership management routes | `/api/future/memberships` |
| 07 Inventory & Purchasing | Inventory purchasing routes | `/api/inventory-purchasing` |
| 08 Loyalty | Loyalty routes | `/api/loyalty` |
| 10 Calendar Integration | Calendar OAuth callback and connection routes | `/api/calendar-oauth`, `/api/future/calendar-connections` |
| 11 Integration Hub | Integration credential API and management routes | `/api/future/integrations/v1`, `/api/future/integrations` |
| 12 CRM & Customer Intelligence | Customer management routes (partial surface only) | `/api/customers` |
| 13 Customer Experience | Existing customer-experience route composition | `/api/customer-experience` |
| 16 Analytics & Business Intelligence | Existing dashboard insight routes | `/api/dashboard/insights` |
| 18 AI Business Adviser | AI advisory/recommendation routes | `/api/ai` |

Existing API mounts are source inventory only. They neither resolve
catalogue-to-entitlement mappings nor demonstrate workflow completeness,
tenant isolation, Stripe/payment safety, calendar provider availability,
or production sign-off. Requirement 12's customer-route reference does
**not** imply its entire intelligence layer has been implemented. Existing
models, controllers, middleware and route registrations are unchanged.
