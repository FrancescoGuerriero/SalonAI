# Runbook — Phase 7.13 CI/CD or release failure

## Safety rule

Do not bypass a failing required check, remove the Trivy ignore expiry, weaken severity thresholds or manually retag an unverified image as a production release.

## CI failure order

1. Open the failed workflow and identify the first failed job rather than the final aggregate `CI complete` job.
2. Reproduce the failing command locally using the same working directory.
3. Correct the source, lockfile, workflow or security policy.
4. Run `scripts\verify-phase7-13.ps1` locally.
5. Push a new commit and allow GitHub Actions to rerun.

## Backend validation failure

Run:

```powershell
npm.cmd --prefix backend ci
npm.cmd --prefix backend run validate
```

The full backend validation includes source checks, application import and automated tests.

## Frontend build failure

Run:

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run build
```

Do not commit `frontend\dist` unless a later phase explicitly changes the source-distribution policy.

## AI-service failure

From `ai-service` activate the project environment, install the dependency manifest and run:

```powershell
python -m compileall -q app
python -m pytest -q
```

## Dependency review failure

Inspect the dependency diff and advisory. Upgrade or remove the newly introduced dependency. An exception is not appropriate merely to make a pull request pass.

## Trivy failure

Download the `salonai-ci-security-*` artifact or inspect the release log. Determine whether the finding is:

- a new dependency or container vulnerability;
- a secret or credential committed to source;
- a Docker/Compose misconfiguration;
- an expired Phase 7.12 exception.

For an expired exception, prioritize a real dependency upgrade. Any renewed exception must be exact, evidence-based, time-limited and separately reviewed.

## CodeQL failure

Open the code-scanning alert and inspect the complete data-flow path. Correct the vulnerable flow and add a regression test where practical. Do not dismiss an alert solely because the application currently runs behind authentication.

## Release image failure

The release workflow does not publish the consolidated GitHub release until all three matrix image jobs pass. A partially pushed GHCR tag may exist for a service that completed before another failed. Do not deploy partial tags. Correct the problem and rerun the workflow for the same annotated tag; release assets are uploaded with replacement enabled.

## Attestation failure

Confirm the workflow has:

- `id-token: write`;
- `attestations: write`;
- `packages: write` for GHCR;
- a valid `sha256:` digest from `docker/build-push-action`.

Do not replace attestation steps with a long-lived signing private key.

## GitHub release publication failure

Confirm **Settings → Actions → General → Workflow permissions** allows writes. The workflow uses `GITHUB_TOKEN`; no personal access token should be added unless repository policy explicitly requires it.

## Rollback evidence

Every successful release publishes `rollback-metadata.json`. It identifies immutable image digests suitable as a later rollback target. Do not use `docker compose --remove-orphans` when SalonAI observability or backup overlay containers are running.


## Windows PowerShell native-command verification

The Phase 7.13 verifier intentionally tests that malformed release tags are rejected. Windows PowerShell 5.1 can convert a native process's expected stderr into `NativeCommandError` when `$ErrorActionPreference` is `Stop`.

The verifier runs the negative tag test through `Start-Process`, captures stdout/stderr in temporary files and evaluates the native exit code directly. An exit code other than zero is the expected passing result for `release-latest`.
