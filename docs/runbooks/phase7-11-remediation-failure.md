# Phase 7.11 Remediation Failure Runbook

1. Read the final error and the latest report at `security-reports/release-gate/latest.json`.
2. Confirm that `backend`, `frontend`, and `ai-service` image report files were generated under `security-reports/trivy`.
3. Inspect the timestamped rollback directory under `backups/phase7-11-security-remediation-*`.
4. To roll back, copy the backed-up Dockerfiles to their original project paths and rebuild the affected services.
5. Do not weaken `release-policy.json` merely to make the gate pass. Record any temporary exception with an owner, reason and expiry date.
