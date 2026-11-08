# DEV1 — Full-stack production-host runtime snapshot evidence

Status: read-only source implementation. No production deployment or automatic polling.

## Collection

`scripts/deployment/Get-ReadOnlyRuntimeSnapshot.ps1` is an **explicit operator-run**
script on a trusted Docker deployment host. It reads the approved release
manifest and obtains Docker inspect data for exactly three application containers:
`salonai-ai-service`, `salonai-backend`, `salonai-frontend`. It records the
container name, image ID, configured immutable image reference, local
`RepoDigests`, running state and health into `runtime-snapshot.json`.
It does not alter containers, read application environment secrets or
connect to external services.

For a local inspection after operator verification, use PowerShell 7:
```powershell
pwsh -File scripts/deployment/Get-ReadOnlyRuntimeSnapshot.ps1 `
  -ReleaseManifestPath ./release-evidence/release-manifest.json `
  -EvidenceDirectory ./deployment-evidence/inspection
```
The generated file is not automatically uploaded, registered or activated.

## Validation

An authenticated management endpoint
`GET /api/system-administration/module-catalogue/fullstack-runtime-snapshot`
uses the **existing** trusted business/all-location authority and
`feature-control:read` permission. It accepts no client filename or URL.
It is disabled by default unless the backend's trusted
`AIIBP_DEPLOYMENT_EVIDENCE_DIRECTORY` is configured and contains:
`deployment.json`, `release-manifest.json`, `smoke-tests.json` and the new
`runtime-snapshot.json`. The existing archived provenance validator must
succeed first.

The verifier compares all three fixed service names, release tag and commit,
running/healthy status, image IDs, configured image references and local
`RepoDigests` against the archived release manifest. Snapshot age cannot
exceed five minutes or be future dated; missing, mismatched or expired
evidence is rejected. No host address, raw image ID, filesystem path or
secrets are returned.

## Interpretation limits

Even a passing, recent operator-collected snapshot is **not** signed host
attestation. A filesystem copy can be stale after collection, the backend
cannot independently confirm that it came from the current host, and Docker
local metadata can be incomplete. Consequently this evidence is described as
**historical host observation**, never `currentReleaseVerified: true` or
`runtimeVerified: true`.

Module-level tenant/location activation, provider functionality and
production sign-off are not inferred. A subsequent source change would
need authenticated live host evidence and approval policy to raise those
statuses; a successful source PR or CI remains insufficient.

No monthly AI usage quotas, autonomous actions or provider activation.
Sole implementation owner DEV1.
