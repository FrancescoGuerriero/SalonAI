# Runbook: release security gate failure

## Immediate actions

1. Do not publish or deploy the candidate release.
2. Open `security-reports/release-gate/latest.json`.
3. Identify whether the block came from secrets, vulnerabilities, misconfiguration, environment-file controls, or Compose controls.
4. Preserve the report before changing dependencies or files.

## Secret finding

Treat a credible secret finding as exposed. Revoke or rotate the credential first, remove it from the repository and history, then rerun the scan. Do not add the secret to an ignore list.

## Vulnerability finding

Confirm the affected package or image layer, fixed version, exploitability, and application exposure. Upgrade or replace the dependency and rebuild the image. A temporary exception requires an owner, expiry date, rationale, and compensating control.

## Misconfiguration finding

Review the affected Dockerfile or Compose service. Prefer least privilege, loopback-only operational ports, read-only mounts, and no-new-privileges.

## Revalidation

Rerun the gate in audit mode, review the updated report, then rerun with `-Enforce` before release.
