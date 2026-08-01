# Phase 7.12 release-gate failure

## Trivy exception expiry parsing

Trivy expects `expired_at` values in RFC 3339 form. Use a complete UTC timestamp such as:

`2026-08-14T23:59:59Z`

A date-only value such as `2026-08-14` is rejected before scanning begins.

## Stale release reports

The Phase 7.12 release gate removes `security-reports/release-gate/latest.json` before every run.
This prevents a failed scan from leaving verification to read evidence from an earlier phase.

## Recovery

Run:

```powershell
powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File ".\scripts\verify-phase7-12.ps1" `
    -ProjectRoot "."
```

Do not rerun dependency installation or Docker builds solely for a Trivy exception-format failure.
