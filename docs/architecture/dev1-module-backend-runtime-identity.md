# DEV1 — Backend process release identity versus deployment archive

Status: internal, read-only source. No production activation or deployment.

The existing deployment archive verifier (#602) checks an historical release
manifest, source commit, three immutable image digests and smoke-check records.
This slice adds a separate backend-process-only comparison that reads the
existing backend environment identity: `APP_VERSION` plus
`RELEASE_SOURCE_COMMIT` (falling back to `COMMIT_SHA` only if absent).
The backend values are compared with the **validated** archived deployment
release tag and commit SHA.

The new `GET /api/system-administration/module-catalogue/backend-runtime-identity`
route requires trusted business membership, all-location scope and
`feature-control:read`. It uses no client-supplied paths or commit IDs and
does not expose raw environment variables, service URLs or credentials.

The dashboard shows a three-state outcome:
- **Match**: the current backend process *reports* the archived tag and SHA.
- **Mismatch**: the backend process reports a different valid tag or SHA.
- **Unknown**: no trusted archive or usable process identity.

Important limits: environment values are self-reported application metadata,
not independently cryptographic proof of the executing image. A match does
**not** validate Docker digests, runtime container health, frontend/AI-service
versions, application host authenticity, tenant feature activation,
per-location readiness, provider integrations or production acceptance.
Accordingly `allContainersVerified`, `runtimeVerified`,
`productionAccepted` and `activationAuthorised` never become true.

This route and the archive source are unconfigured for production by default.
Independent live host/container attestation, provider readiness,
module-specific smoke tests and operator approval remain subsequent slices.

DEV1 sole owner. The previously removed monthly AI quota feature remains out
of scope.
