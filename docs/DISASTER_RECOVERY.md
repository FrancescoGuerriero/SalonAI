# Disaster Recovery

Target objectives must be approved by the business owner.

Suggested initial targets:

- Recovery point objective: 24 hours
- Recovery time objective: 4 hours

Recovery procedure:

1. Declare the incident and preserve logs.
2. Stop writes if data corruption is suspected.
3. Select the latest verified encrypted backup.
4. Restore into an isolated recovery database.
5. Validate record counts, indexes and critical workflows.
6. Rotate exposed credentials.
7. Deploy the last known-good application image.
8. Redirect traffic after verification.
9. Record the incident and corrective actions.
