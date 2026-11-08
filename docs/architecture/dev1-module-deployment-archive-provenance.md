# DEV1 — AIIBP module deployment archive provenance

Status: source-only, no deployment activation or environment access automatically enabled.

## Existing evidence contracts

The existing release and deployment scripts create `release-manifest.json`,
`deployment.json` and `smoke-tests.json`. The new read-only verifier can
inspect **only** these three fixed filenames from an explicitly configured
trusted server-side directory, `AIIBP_DEPLOYMENT_EVIDENCE_DIRECTORY`.
The directory is **unset by default**; the endpoint therefore returns an
unknown result rather than manufacturing deployment evidence. It does not
fetch arbitrary URLs, accept client-controlled filesystem paths or read
production secrets.

The existing deployment manifest is tied to a release source commit, three
immutable image digests (backend, frontend, AI service), a SHA-256 release
manifest checksum and five completed smoke checks. The verifier checks those
facts against the archived files and reports only release tag, short-lived
historical metadata, commit, time and verification counts. It does not send
URLs, host addresses, raw diagnostics or credentials to the dashboard.

## Security boundary

`GET /api/system-administration/module-catalogue/deployment-provenance`
requires authentication, trusted tenant membership, all-location management
authority and effective `feature-control:read` permission before reading
files. The result is shared-deployment metadata **not** business-specific
module enablement evidence. It must not be used to authorise tenant actions.

Files must be regular (not symbolic links) and <=256 KiB. File basenames
are hard-coded, so no traversal based on request inputs is possible.
Absent, mismatched or unusable evidence returns unknown with no raw errors.

The verification checks consistency of *archived* output. It does not
independently prove signed artifact origin or a currently running release.
Even if it succeeds, `currentReleaseVerified`, `runtimeVerified` and
`productionAccepted` all remain unknown. Platform feature switches,
module provider readiness and tenant/location operational acceptance are
separate gates.

## Further acceptance

Before making a current-deployment or runtime-health claim, DEV1 must
add a trusted live release identity probe, verify container image digests
against a retained approved manifest, verify rollback status, correlate
the evidence with a specific GitHub deployment workflow run and perform
signed/attested artifact verification. Only thereafter may module-specific
acceptance evidence be considered, and never automatically approved.

No provider action, AI monthly quota, tenant subscription change or
production deployment is made here. Sole owner: DEV1.
