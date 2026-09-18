# SalonAI Integration Platform Foundation

## Purpose

This layer provides a provider-neutral boundary for future SalonAI integrations. It is intentionally not an API endpoint, database model, credential store or production activation mechanism.

Developer 1 owns application development and the product roadmap. Developer 2 and Developer 3 operate as independent audit/checking lanes whose findings feed Developer 1 implementation.

## Development roles

### Developer 1 — application builder

Developer 1 owns:

- roadmap implementation;
- backend, frontend and AI architecture;
- schemas and API contracts;
- external integrations;
- operations, CRM/retention, analytics/BI, AI and automation;
- integration of validated audit findings;
- CI/CD and release coordination.

Normal feature development is performed through Developer 1 feature branches.

### Developer 2 — error and quality audit

Developer 2 independently checks the application for bugs, regressions, UI/UX defects, accessibility issues, responsive/layout problems, loading/error/recovery defects and visual inconsistencies.

Developer 2 records reproducible evidence and verifies Developer 1 corrections. Major application features or architecture are not independently implemented by this lane unless a narrowly scoped corrective patch is explicitly delegated.

### Developer 3 — feature and dashboard completeness audit

Developer 3 independently checks management/dashboard workflows for missing, incomplete, incorrectly wired or inconsistent functionality.

Developer 3 records expected behaviour, affected surfaces and acceptance criteria, then verifies Developer 1 implementation. Major management, RBAC, schema or control-plane changes are not independently implemented by this lane unless explicitly delegated.

## Repository model

SalonAI uses one authoritative repository. Independent work may use separate local worktrees/clones, but they share the same Git history, issues, CI and release process.

- Developer 1 uses short-lived roadmap branches such as `integrations/*`, `operations/*`, `crm/*`, `analytics/*` and `ai/*`.
- Developer 2/3 use audit/reproduction branches only when a code branch is necessary.
- `main` remains the PR integration and release baseline.

A finding follows this path:

1. Developer 2/3 reproduces and documents it.
2. Developer 1 triages it against current architecture and roadmap.
3. Developer 1 implements the correction/feature on a dedicated branch.
4. automated gates run;
5. Developer 2/3 re-checks the corrected behaviour;
6. Developer 1 integrates and releases.

## Foundation contracts

`integrationCatalog.js` describes stable integration IDs, provider categories, implementation status and allowed capabilities.

`integrationRegistry.js` registers runtime adapters against those definitions. Public descriptors intentionally omit adapter objects so credentials and provider clients cannot be exposed by catalogue/status responses later.

The catalogue distinguishes **implemented in the codebase** from **planned**. Implemented does not mean a provider is enabled or healthy in a specific environment.

## Current catalogue

Implemented code paths:

- Stripe — checkout, webhooks and idempotency
- Twilio — SMS, WhatsApp and messaging status webhooks

Planned adapter families:

- Google Calendar
- Microsoft Outlook Calendar
- Mailchimp
- Xero
- QuickBooks
- POS adapter
- Meta social surfaces
- Google Business Profile

## Integration sequence

Each provider should be added through Developer 1 in this order:

1. provider-independent contract/capability definition;
2. adapter implementation behind the registry;
3. isolated unit/contract tests with no production credentials;
4. environment/config validation;
5. signed webhook/idempotency handling where applicable;
6. API/service wiring;
7. management/customer UI after backend contracts are stable;
8. sandbox acceptance evidence;
9. independent Developer 2/3 verification where relevant;
10. immutable release and controlled production activation.

## Conflict rule

Developer 2/3 findings should not produce competing implementations. Developer 1 owns the implementation and cross-cutting contracts.

If a narrowly delegated audit-lane patch overlaps an active Developer 1 branch, integrate one branch first, then rebase and rerun the second branch against the new `main`.

Architectural decisions must be resolved before merge, not through last-minute Git conflict resolution.

## Security constraints

- never place API keys, refresh tokens, webhook secrets or access tokens in the catalogue;
- registry descriptors must never serialize adapter objects or credentials;
- provider webhooks require signature validation and replay/idempotency protection;
- OAuth providers must use least-privilege scopes and encrypted token storage;
- production activation remains separate from code merge;
- feature/RBAC enforcement remains governed by SalonAI application policy rather than bypassed by provider adapters.
