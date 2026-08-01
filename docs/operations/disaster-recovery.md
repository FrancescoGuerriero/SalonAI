# SalonAI Disaster Recovery

## Recovery objectives

Initial operational targets for the local production deployment:

- Recovery point objective (RPO): no more than 24 hours with the default backup interval.
- Recovery time objective (RTO): validate quarterly using the automated restore drill; record the observed duration rather than assuming a fixed value.
- Backup retention: 14 days locally, minimum 3 backup families.
- Off-host retention: 30 days by default when using the mirror script.

These targets should be revised when SalonAI has real booking volume, regulatory requirements or contractual service commitments.

## Failure scenarios

### MongoDB data corruption

1. Put the application into maintenance mode.
2. Preserve the current volume before destructive action.
3. Select a checksum-verified backup.
4. Run the production restore procedure.
5. validate collection/document counts, health endpoints and critical user journeys.

### Workstation or disk loss

1. Rebuild the host and install Docker Desktop.
2. Recover the SalonAI repository and production environment files from secure storage.
3. Recover an off-host MongoDB backup family.
4. Start MongoDB and restore the selected archive.
5. Build and start application and observability containers.
6. run Phase 7.8, 7.9 and 7.10 live verification.

### Accidental deployment damage

1. Preserve logs and collect a DR snapshot.
2. revert code and configuration to a known Git commit.
3. rebuild application images.
4. use database restore only when the deployment changed or damaged persisted data.

### Backup-service failure

1. inspect `salonai-mongo-backup` logs;
2. verify MongoDB health and credentials;
3. verify write access to `backups/mongodb`;
4. run `scripts/backup-mongodb.ps1` manually;
5. follow the backup-failure runbook if the manual backup also fails.

## Disaster-recovery drill

Run:

```powershell
powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File ".\scripts\run-disaster-recovery-drill.ps1"
```

The drill creates a fresh backup, restores it into an isolated MongoDB container and records RPO/RTO validation timing under `backups/dr-drills`.

## Evidence collection

```powershell
powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File ".\scripts\collect-phase7-10-dr-snapshot.ps1"
```

The snapshot includes Compose configuration, container state, image digests, volume inventory, backup-service logs and the latest backup metadata. It records environment variable names only, not values.

## Backup security

- Restrict access to the project backup directory.
- Use encrypted off-host storage.
- Never email backup archives or place them in a public repository.
- Treat every archive as production personal data.
- Rotate MongoDB credentials if a backup destination is exposed.

## Verification cadence

- Daily: automatic backup and off-host mirror.
- Weekly: isolated restore drill.
- Monthly: review backup age, retention and failed task history.
- Quarterly: full workstation-recovery tabletop exercise.
- After major schema changes: create and restore-test a fresh backup.
