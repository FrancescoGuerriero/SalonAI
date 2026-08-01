# Phase 7.14 Deployment Failure Runbook

## Stop conditions

Stop the deployment when any of these occurs:

- production environment validation fails;
- TLS files are missing or empty;
- the release manifest is missing or does not match the environment;
- an application image is not pinned by SHA-256 digest;
- merged Compose validation fails;
- image pull fails;
- a container remains unhealthy;
- an HTTPS smoke test fails.

## Immediate actions

1. Do not delete named Docker volumes.
2. Do not run `docker compose down -v`.
3. Capture the deployment evidence directory and container logs.
4. Confirm the production environment file was not printed to logs.
5. Identify the last verified GitHub release.
6. Download that release's `release-manifest.json`.
7. Run the manifest-driven rollback script.
8. Repeat all HTTPS smoke tests.

## Rollback command

```powershell
$Project = "C:\path\to\SalonAI"

powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File "$Project\scripts\deployment\Rollback-Production.ps1" `
    -ProjectRoot $Project `
    -EnvironmentFile "$Project\.env.production" `
    -RollbackManifestPath "$Project\release-evidence\previous-release-manifest.json"
```

## MongoDB protection

Named volumes contain production data. For a database-affecting deployment,
confirm a successful Phase 7.10 backup before retrying. Never use
`--remove-orphans` while observability or resilience overlays are running.

## Escalation evidence

Retain:

- release tag and source commit;
- release-manifest checksum;
- immutable application image references;
- GitHub Actions run URL;
- deployment and smoke-test JSON;
- `docker compose ps`;
- relevant container logs;
- rollback release manifest and result.
