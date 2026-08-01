# Disaster Recovery

Suggested initial targets:

- Recovery point objective: 24 hours
- Recovery time objective: 4 hours

Recovery process:

1. Preserve logs and declare the incident.
2. Stop writes when data corruption is suspected.
3. Restore the latest verified backup into an isolated database.
4. Validate record counts, indexes and critical workflows.
5. Rotate exposed credentials.
6. deploy the last known-good application release.
7. Verify the recovered system before restoring traffic.
8. Record the incident and corrective actions.
