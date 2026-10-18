# Permanent Figma ↔ React synchronization

Issue: #449  
Figma file: `roTSaBJuQTYNJpBInNahXQ`

## Contract

SalonAI/AIIBP uses a **reviewed bidirectional design-system sync**:

- **React/code is production authority.** Figma never changes RBAC, tenancy, API contracts, business logic, data, or runtime state.
- **Figma → code:** scheduled/manual automation pulls managed Figma Variables into `frontend/figma/aiibp.tokens.json`, regenerates CSS, and opens/updates a reviewable PR when design-token values change.
- **Code → Figma:** after approved token changes merge to `main`, automation pushes the token manifest back to the same Figma Variables and publishes Code Connect mappings.
- **CI drift protection:** local/PR validation requires generated CSS to match the committed manifest and validates Code Connect templates.
- **Stable identities:** synchronized tokens keep Figma variable IDs, collection IDs, and mode IDs in the versioned manifest. New variables are not silently accepted; they require an explicit manifest addition.

This gives designers and engineers continuous synchronization without allowing a Figma edit to bypass code review, accessibility tests, security gates, or release controls.

## Bootstrap status

The live AIIBP Figma file has already been aligned to this contract through the interactive Plugin API:

- all 34 managed variables were found;
- 27 WEB code-syntax mappings were moved to the stable `var(--aiibp-...)` namespace;
- 7 mappings were already correct;
- no variable values, aliases, scopes, or component behavior were changed during the bootstrap.

The repository automation therefore begins from a known matching design-token baseline rather than from an inferred migration.

## Repository layout

- `frontend/figma/aiibp.tokens.json` — versioned bridge manifest for the three managed Figma collections.
- `frontend/src/styles/aiibpTokens.generated.css` — deterministic React/CSS output. Never edit by hand.
- `frontend/scripts/figma-sync.mjs` — `generate`, `check`, `pull`, `push`, and `remote-check`.
- `frontend/figma.config.json` — Figma Code Connect project configuration.
- `frontend/figma/code-connect/*.figma.ts` — production component mappings.
- `.github/workflows/figma-react-sync.yml` — CI validation, scheduled Figma pull, and `main` publication.

## Local commands

From `frontend/`:

```bash
npm run figma:generate
npm run figma:check
npm run figma:pull
npm run figma:push
npm run figma:remote-check
npm run figma:code-connect:validate
npm run figma:code-connect:publish
```

`generate` and `check` are offline. Remote commands require `FIGMA_ACCESS_TOKEN`.

## GitHub configuration

Create the repository Actions secret:

- `FIGMA_ACCESS_TOKEN`

The token must belong to a Figma account with edit access to the AIIBP design-system file.

For Variables REST synchronization it needs:

- `file_variables:read`
- `file_variables:write`

Do **not** store the token in `.env`, source files, workflow YAML, issue comments, or Figma descriptions.

The workflow intentionally treats a missing token as “automation not activated yet” and skips remote writes. Once the secret exists, the scheduled pull and post-merge publish paths activate without code changes.

For scheduled Figma → code PR creation, the repository must also permit GitHub Actions to create pull requests. If repository policy disables that capability, the pull job fails visibly rather than writing directly to `main`.

## Figma plan requirement / current blocker

The current Figma workspace rejected a Code Connect mapping with:

> Code connections can only be made in libraries that are in Organization or Enterprise plans.

There is also a stricter requirement for unattended variable synchronization: Figma's Variables REST API is available only to Enterprise organizations, and write access requires an eligible full seat plus edit access.

Therefore **full automatic Figma ↔ React synchronization requires moving this design-system file to an Enterprise Figma workspace (or upgrading the current workspace) and supplying the scoped access token**.

Until that external prerequisite is satisfied:

- the repository contract, generated token layer, local validation, CI validation, and automation workflows remain installed;
- the existing Figma file can still be edited through the interactive Figma integration;
- unattended GitHub Actions pull/push and Code Connect publication cannot complete against the current plan.

## Synchronization safety

### Managed scope

Only these collections are synchronized:

- `AIIBP Primitives`
- `AIIBP Semantics`
- `AIIBP Layout`

A new variable appearing in one of these collections causes the automated pull to fail closed. Add it deliberately to `aiibp.tokens.json`, review its CSS name/scope/type, then resume.

### Figma-originated changes

The scheduled workflow:

1. downloads the local variables;
2. updates only existing allow-listed tokens;
3. regenerates CSS;
4. runs the deterministic token check;
5. commits changes to `automation/figma-token-sync`;
6. creates or updates a PR into `main`.

No Figma-originated change is written directly to `main`.

### Code-originated changes

On relevant changes merged to `main`, the workflow:

1. validates the manifest and generated CSS;
2. atomically updates the managed Figma variables through the Variables REST API;
3. publishes Code Connect templates using the pinned `@figma/code-connect@2.0.0` CLI;
4. fails visibly if plan, token scope, or Figma permissions are insufficient.

## Code Connect

The published Figma `Button` component set (`5:9`) maps to:

`frontend/src/components/ui/Button.jsx`

The template maps:

- Figma `Style=Primary` → React `variant="primary"`
- Figma `Style=Secondary` → React `variant="secondary"`
- Figma `Label` → React children

As additional Figma components become production library components, add a corresponding `.figma.ts` template in `frontend/figma/code-connect/`. Keep component behavior in React; Code Connect documents the production implementation in Figma Dev Mode.

## Operational ownership

- DEV2 owns token/component mapping quality and design-system drift.
- DEV1 owns merge/release integration.
- DEV3/DEV4 remain authoritative for RBAC, tenant, location, entitlement and business semantics.
- Figma is never an authority source for those runtime contracts.
