# SalonAI Phase 7.15 — Production Environment Provisioning and Go-Live Readiness

## Purpose

Phase 7.15 converts the Phase 7.14 deployment baseline into an auditable go-live
readiness process. It does not perform a public production deployment.

## One-command workflow

After pull request #10 is merged, run the package launcher from its extracted
directory. The launcher:

1. verifies that the Phase 7.14 commit is present in `origin/main`;
2. requires a clean repository;
3. updates local `main` using fast-forward only;
4. creates or switches to `phase-7.15-production-readiness`;
5. installs all Phase 7.15 files;
6. creates an ignored readiness input file;
7. runs the Phase 7.15 static verifier.

Nothing is staged, committed, pushed or deployed.

## External prerequisites

The following actions cannot be safely inferred or completed from a repository
package:

- rotate the previously exposed MongoDB credentials in the actual database
  provider;
- invalidate the previously exposed JWT signing secret in every active runtime;
- choose the real production domain and configure DNS;
- obtain and install valid TLS certificate files;
- configure the protected GitHub `production` environment;
- register and secure the self-hosted runner labelled `salonai-production`;
- publish an approved semantic release and download its `release-manifest.json`.

Mark a confirmation as `true` only after completing and independently verifying
the corresponding external action.

## Readiness input

Edit:

`deployment-evidence/phase7-15/inputs.json`

The directory is ignored by Git. Do not move production values or evidence into
tracked configuration files.

## Complete readiness run

```powershell
$Project = "C:\Users\Francesco\Desktop\CS_Projects\SalonAI_V2\SalonAI"

powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File "$Project\scripts\production\Invoke-Phase7-15Readiness.ps1" `
    -ProjectRoot $Project `
    -GenerateEnvironment `
    -RunGitHubChecks `
    -Strict
```

Add `-PullImages` only when the production host is authorised to authenticate to
GHCR and download the immutable release images.

## Evidence

The readiness process writes:

- `deployment-evidence/phase7-15/readiness-evidence.json`
- `deployment-evidence/phase7-15/readiness-summary.md`

These files must show zero pending and zero failed checks before a go-live review.

## Security boundaries

- Generated secrets are never displayed.
- `.env.production` must remain ignored and untracked.
- Local secret generation is not evidence that external credentials were rotated.
- The rehearsal validates Compose configuration without starting containers.
- The scripts never use `docker compose --remove-orphans`.
- Production deployment remains a separate, protected Phase 7.14 workflow action.
