# Runbook: MongoDB Backup Failure

## Trigger

Use this runbook when:

- `salonai-mongo-backup` is unhealthy;
- `backups/mongodb/status/last-failure.txt` exists;
- no successful backup exists within the RPO window;
- a checksum or manifest check fails.

## Immediate actions

1. Do not delete the most recent valid backup.
2. Check the backup container:

```powershell
docker inspect salonai-mongo-backup --format '{{json .State}}'
docker logs salonai-mongo-backup --tail 200
```

3. Check MongoDB:

```powershell
docker inspect salonai-mongo --format '{{json .State}}'
docker logs salonai-mongo --tail 200
```

4. Confirm free disk space:

```powershell
Get-PSDrive -PSProvider FileSystem
```

5. Run a manual backup:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\backup-mongodb.ps1"
```

## Common causes

- invalid MongoDB credentials in `.env.production`;
- Docker Desktop or MongoDB not running;
- the backup directory is not writable;
- insufficient disk space;
- a partial archive left after an interrupted backup;
- antivirus or synchronisation software locking a file.

Partial files end in `.partial` and are safe to remove only when no backup command is running.

## Recovery validation

After backup creation succeeds, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\test-mongodb-restore.ps1"
```

The incident is resolved only after both backup integrity and isolated restore validation pass.
