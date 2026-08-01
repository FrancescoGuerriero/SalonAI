# Runbook: MongoDB Production Restore

## Warning

This procedure replaces database contents. A restore can permanently remove newer data. Use it only for an approved recovery event.

## Preconditions

- identify the incident owner and restore decision-maker;
- record the selected archive timestamp and expected data loss;
- verify the `.sha256` file;
- review the JSON manifest;
- run an isolated restore test against the same archive;
- preserve the current MongoDB volume or take a forensic snapshot when possible;
- notify affected users before maintenance begins.

## Select and test the backup

```powershell
Get-ChildItem ".\backups\mongodb\salonai-mongodb-*.archive.gz" |
    Sort-Object LastWriteTimeUtc -Descending

powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File ".\scripts\test-mongodb-restore.ps1" `
    -BackupPath ".\backups\mongodb\salonai-mongodb-YYYYMMDDTHHMMSSZ.archive.gz"
```

Do not proceed when the restore test fails.

## Restore

```powershell
powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File ".\scripts\restore-mongodb.ps1" `
    -BackupPath ".\backups\mongodb\salonai-mongodb-YYYYMMDDTHHMMSSZ.archive.gz" `
    -ConfirmRestore `
    -ConfirmDataLoss `
    -StopApplication
```

`-StopApplication` stops edge and backend services during the destructive restore and starts them again afterward.

## Post-restore validation

1. Confirm container health:

```powershell
docker compose `
    --env-file ".\.env.production" `
    -f ".\docker-compose.production.yml" `
    -f ".\docker-compose.observability.yml" `
    -f ".\docker-compose.resilience.yml" `
    ps --all
```

2. Run production health checks.
3. Test authentication, service catalogue, appointments and admin access.
4. Run Phase 7.8, 7.9 and 7.10 verification.
5. record actual RPO and RTO.
6. preserve the incident snapshot and restore output.

## Rollback of a failed restore

If the restored database is unusable, keep the application in maintenance mode and restore the preserved pre-incident snapshot or another verified backup. Do not repeatedly restore unverified archives.
