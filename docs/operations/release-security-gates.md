# Release security gates

## Audit a candidate release

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\security\run-release-security-gate.ps1" -ProjectRoot "."
```

Audit mode records all findings but does not block the command.

## Enforce the release policy

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\security\run-release-security-gate.ps1" -ProjectRoot "." -Enforce
```

The default policy blocks:

- any detected repository secret;
- any fixable critical repository vulnerability;
- any fixable critical application-image vulnerability;
- any high or critical infrastructure misconfiguration;
- tracked production environment files or known default production credentials;
- critical Docker Compose security violations.

## Policy changes

Change thresholds only through review of `config/security/release-policy.json`. Do not suppress a finding merely to obtain a green result. Record the rationale, owner, expiry date, and compensating control for any temporary exception.

## Recommended release sequence

1. Build the application images.
2. Run the Phase 7.11 audit.
3. Review the JSON reports and SBOM manifest.
4. Remediate or document findings.
5. Run the gate with `-Enforce`.
6. Archive a security evidence snapshot with `scripts/collect-phase7-11-security-snapshot.ps1`.
