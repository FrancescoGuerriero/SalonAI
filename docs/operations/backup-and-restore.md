# SalonAI Backup and Restore

## Scope

Phase 7.10 protects the production MongoDB database with logical backups created by `mongodump`. Each backup family contains:

- `salonai-mongodb-<UTC timestamp>.archive.gz`
- the matching `.archive.gz.sha256` checksum
- a JSON manifest with the database name, archive size, checksum, creation time and informational post-dump collection/document counts

Backups are stored under `backups/mongodb` in the SalonAI project directory. This location is intentionally accessible from Windows so that archives can be copied to encrypted off-host storage.

## Automatic backups

The `salonai-mongo-backup` container starts with the production stack overlay and creates a backup immediately. It then repeats according to `MONGO_BACKUP_INTERVAL_SECONDS`.

Default policy:

- interval: 24 hours
- retention: 14 days
- minimum retained backup families: 3
- format: compressed MongoDB archive
- integrity: SHA-256 checksum

Optional settings are documented in `config/phase7-10.env.example`. Add overrides to `.env.production`; do not put production secrets in the example file.

Start or update the backup service:

```powershell
docker compose `
    --env-file ".\.env.production" `
    -f ".\docker-compose.production.yml" `
    -f ".\docker-compose.observability.yml" `
    -f ".\docker-compose.resilience.yml" `
    up -d mongo-backup
```

## Manual backup

```powershell
powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File ".\scripts\backup-mongodb.ps1"
```

The script starts the backup service when required, creates a new backup, verifies its checksum and manifest, and prints the archive path.

## Isolated restore test

This is the safe validation path. It never modifies the production MongoDB container.

```powershell
powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File ".\scripts\test-mongodb-restore.ps1"
```

The script:

1. selects the latest verified archive;
2. starts a temporary isolated `mongo:7.0` container;
3. restores the archive;
4. records restored collection and document counts and compares them with the informational post-dump source observation;
5. writes evidence under `backups/restore-tests`;
6. removes the temporary container.

## Off-host mirror

A backup stored on the same workstation does not protect against disk loss, theft, ransomware or accidental deletion. Mirror verified backup families to an encrypted external disk, NAS or approved cloud-synchronised directory.

```powershell
powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File ".\scripts\mirror-mongodb-backups.ps1" `
    -Destination "E:\SalonAI-Offsite-Backups"
```

Use BitLocker or an equivalently protected destination because MongoDB archives may contain personal data.

## Scheduled mirror and restore drill

```powershell
powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File ".\scripts\register-phase7-10-scheduled-tasks.ps1" `
    -MirrorDestination "E:\SalonAI-Offsite-Backups"
```

This registers:

- a daily off-host mirror task;
- a weekly backup-and-isolated-restore drill.

The workstation and Docker Desktop must be running at the scheduled time. Windows Task Scheduler uses `StartWhenAvailable` when a scheduled execution is missed.

## Production restore

Production restore is destructive and is deliberately guarded by two explicit switches. Follow `docs/runbooks/mongodb-production-restore.md` before running it.

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

Do not restore a production database merely to test a backup. Use the isolated restore script instead.
