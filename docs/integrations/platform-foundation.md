# SalonAI Integration Platform Foundation

## Purpose

This layer provides a provider-neutral boundary for future SalonAI integrations. It is intentionally not an API endpoint, database model, credential store or production activation mechanism.

The first foundation keeps external-provider work separate from active Developer 2 UI/accessibility work and Developer 3 dashboard/RBAC/control-plane work.

## Repository and lane model

SalonAI uses one authoritative repository with isolated worktrees or clones:

- Developer 1: `integrations/*`, `operations/*`, `crm/*`, `analytics/*`, `ai/*`
- Developer 2: `errors-improvements/*`
- Developer 3: `dashboard/*`
- `main`: PR integration and release only

Separate repositories are not used for these lanes because the frontend, backend, AI service, MongoDB contracts, CI workflows and immutable release process form one deployable product.

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

Each provider should be added in a short-lived PR with this order:

1. provider-independent contract/capability definition;
2. adapter implementation behind the registry;
3. isolated unit/contract tests with no production credentials;
4. environment/config validation;
5. signed webhook/idempotency handling where applicable;
6. API/service wiring;
7. management UI only after backend contracts are stable;
8. sandbox acceptance evidence;
9. immutable release and controlled production activation.

Do not mix provider activation with unrelated dashboard or visual changes.

## Conflict rule

If another developer needs to consume an integration contract while Developer 1 is changing it, merge the contract PR first. The consuming developer rebases onto that contract and implements against the merged interface. Two developers should not independently edit the same contract file and resolve semantics through a last-minute Git conflict.

## Security constraints

- never place API keys, refresh tokens, webhook secrets or access tokens in the catalogue;
- registry descriptors must never serialize adapter objects or credentials;
- provider webhooks require signature validation and replay/idempotency protection;
- OAuth providers must use least-privilege scopes and encrypted token storage;
- production activation remains separate from code merge;
- feature/RBAC enforcement remains governed by the application control plane rather than bypassed by provider adapters.
