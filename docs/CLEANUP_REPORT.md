> Historical stabilisation report. Phase 2 development and current validation results are documented in `PHASE_2_RELEASE_REPORT.md`.

# SalonAI Cleanup and Stabilisation Report

**Completed:** 25 July 2026  
**Scope:** Full project archive audit, repair, deduplication, import correction, route verification, access-control review and development packaging.

## Final status

The repaired project has a single coherent Express backend, a React/Vite frontend, locked dependency manifests, environment templates, Windows development helpers and no packaged dependency/build/cache folders.

### Verified results

| Check | Result |
|---|---:|
| JavaScript/JSX modules parsed | 344 |
| Parse errors | 0 |
| Unresolved local imports | 0 |
| Missing imported exports | 0 |
| Backend JavaScript syntax files checked | 204 |
| Backend application import | Passed |
| Backend tests | 11 passed, 0 failed |
| Backend endpoints mapped | 256 |
| Frontend HTTP calls mapped | 114 |
| Frontend calls without a backend route | 0 |
| Missing declared runtime dependencies | 0 |
| Unused declared runtime dependencies | 0 |
| Exact duplicate source/config files | 0 |
| Duplicate Mongoose model registrations | 0 |
| Merge-conflict markers | 0 |
| Case-insensitive path collisions | 0 |
| Live `.env` files or exposed credentials included | 0 |

The five modules reported as unreachable by the application-entry graph are intentional standalone entry points: three backend maintenance scripts, the backend test file and `frontend/vite.config.js`.

## Repairs completed

### 1. Project structure and packaging

Removed generated or machine-specific content that should never be distributed as source:

- `.git/` history and internal objects
- backend and frontend `node_modules/`
- frontend `dist/`
- repair/amendment backup directories
- runtime logs and old command-output files
- live backend/frontend `.env` files
- obsolete Vite starter assets

Added:

- root `.gitignore`
- root setup and development `README.md`
- backend and frontend `.env.example` files
- frontend-specific README
- `scripts/verify-project.ps1`
- `scripts/start-dev.ps1`
- this cleanup report

The final archive deliberately excludes dependencies. Run `npm ci` separately in `backend` and `frontend` so npm installs the native packages appropriate to the current operating system.

### 2. Duplicate and redundant code

Removed confirmed exact copies and superseded modules, including:

- `backend/src/features/inventory copy/`
- ten frontend service files named `* copy.js`
- the superseded `futurePackRoutes.js`
- duplicate feature-level `CommunicationTemplate` and `CustomerNote` models
- duplicate feature authentication/role helpers
- obsolete scheduler provider-webhook feature modules
- stale alternative customer, dashboard, feature-page and UI component implementations
- duplicate API clients and superseded appointment/customer service wrappers
- React page files incorrectly stored under backend or frontend service directories

The alternate future customer-profile modules were renamed to `futureCustomerProfile*` so they cannot be confused with the canonical customer-profile route/controller/service.

Same-named service files that remain on both tiers are intentional: frontend files are HTTP client adapters, while backend files contain domain/business logic.

### 3. Import and module corrections

- Corrected feature router directory/import mismatches.
- Corrected ten frontend service imports that traversed one directory too far when importing the Axios client.
- Moved the customer-value HTTP client from the backend into the frontend service layer.
- Replaced duplicate Axios wrappers with the canonical client.
- Updated all imports affected by moves, removals and customer-profile renaming.
- Verified all local default and named imports against their target exports.

### 4. Frontend/backend contract repairs

- Repaired appointment-calendar handling of the backend `{ appointments }` response envelope.
- Normalised appointment fields around `startsAt` and `endsAt`, with safe date/time fallbacks.
- Filtered malformed calendar records and surfaced loading errors to the UI.
- Removed frontend API methods for endpoints that did not exist.
- Matched every remaining frontend HTTP call against an Express route, including parameterised and chained routes.

### 5. Mongoose model integrity

Feature modules previously registered simplified models using the same Mongoose model names as canonical models. Import order could therefore cause services to receive the wrong schema.

Repaired by:

- making template and campaign features import the canonical `CommunicationTemplate` model
- making customer-profile features import the canonical `CustomerNote` model
- adapting note aliases to the canonical content/type/visibility fields
- changing future-profile note deletion to the canonical soft-delete behaviour
- deleting the competing schema definitions

Final model scan found no duplicate Mongoose registrations.

### 6. Authentication and authorisation

Applied canonical authentication and role middleware to management data and mutation routes, including:

- dashboard and insight analytics
- customer-retention analytics
- communication templates
- customer-contact logs
- customer records
- administration endpoints
- service catalogue mutations
- future-feature management routes

Frontend routing now distinguishes authenticated customer booking from management-only screens. Admin routing, navigation visibility and loading behaviour use the shared authentication context.

Backend tests verify that eleven representative protected/public/error paths return the expected status without requiring a database connection.

### 7. Error handling and configuration

- Consolidated unknown-route and application-error JSON handling.
- Added appropriate default error codes by HTTP status.
- Restricted server-error logging to 5xx responses.
- Exposed stack traces only when `NODE_ENV=development` is set explicitly.
- Added structured handling for validation, cast and duplicate-key errors.
- Made CORS use `FRONTEND_URL`, with compatibility fallback to `CLIENT_URL` and then localhost.
- Removed unused backend dependencies and moved frontend build tooling to `devDependencies`.
- Added compatible Node/npm engine declarations.

## Validation notes

Backend validation completed successfully with:

```powershell
npm --prefix backend run validate
```

The package-lock dependency trees also pass `npm ls --package-lock-only --all` for both applications.

A complete Linux Vite build could not be executed from the uploaded dependency folder because it contained Windows native binaries, and the validation environment could not reinstall the Linux optional binaries from npm. This is an environment/package-install limitation rather than an unresolved source import error. The final archive excludes that folder. On the target Windows machine, run:

```powershell
npm --prefix frontend ci
npm --prefix frontend run build
```

The frontend source passed JSX parsing, import/export resolution, dependency declaration and API-route matching checks before packaging.

## Development start

Use Node.js **20.19+** in the Node 20 line, or **22.12+**, with npm 10+.

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Set at least `MONGODB_URI` and a new strong `JWT_SECRET`, then run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\verify-project.ps1
.\scripts\start-dev.ps1
```

Do not restore the old `node_modules`, `.env`, `dist`, backup or duplicate-copy folders into this cleaned project.
