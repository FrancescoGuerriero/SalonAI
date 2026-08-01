# SalonAI Phase 7.16 production cutover

## Purpose

Phase 7.16 adds a controlled, auditable path from Phase 7.15 readiness to a
production cutover. It does not make SalonAI production-ready by itself and it
does not perform a deployment during installation, static verification or dry
run.

## Required sequence

1. Merge Phase 7.15 into `main`.
2. Install Phase 7.16 on `phase-7.16-production-cutover`.
3. Complete the external Phase 7.15 prerequisites:
   - rotate the exposed MongoDB and JWT credentials;
   - configure the protected GitHub `production` environment;
   - register an online self-hosted runner labelled `salonai-production`;
   - configure the real domain and DNS;
   - install valid TLS certificates;
   - approve an immutable release manifest.
4. Produce successful Phase 7.15 readiness evidence.
5. Create Phase 7.16 cutover inputs and backup evidence.
6. Run Phase 7.16 preflight and dry run.
7. Review all evidence and approve the change window.
8. Run the dedicated cutover script only with the exact confirmation token.
9. Complete hypercare and create closure evidence.

## Non-deploying commands

Create the ignored input file:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\production\New-Phase7-16CutoverInput.ps1 `
  -ProjectRoot .
```

Run a non-destructive dry run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\production\Invoke-Phase7-16DryRun.ps1 `
  -ProjectRoot . `
  -Strict
```

The dry run never calls the deployment or rollback scripts.

## Controlled cutover

A real cutover is permitted only after every preflight item passes and the
approved change window is active:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\production\Invoke-Phase7-16Cutover.ps1 `
  -ProjectRoot . `
  -ConfirmCutover "DEPLOY-SALONAI-PRODUCTION"
```

Rollback is not automatic by default. To permit a rollback after a cutover
failure, both the switch and exact rollback token are required.

## Evidence

Ignored evidence is written under:

`deployment-evidence/phase7-16`

Expected records include:

- `preflight-evidence.json`
- `preflight-summary.md`
- `dry-run.json`
- `cutover-started.json`
- `cutover-complete.json` or `cutover-failure.json`
- `hypercare.json`
- `cutover-closure.json`

## Safety boundaries

- No secrets belong in tracked files.
- The installer, verifier, input generator, preflight and dry run cannot deploy.
- Production images must use immutable GHCR digest references.
- `docker compose --remove-orphans` is prohibited.
- A recent backup and restore-test reference are mandatory.
- A distinct rollback release manifest is mandatory.
- Deployment remains blocked until the user explicitly authorises the cutover.
