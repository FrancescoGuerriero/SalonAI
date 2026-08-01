# Phase 7.12 Dependency Maintenance Failure

## tmp finding remains

Confirm that `backend/package.json` contains an override for `tmp` version `0.2.7`, regenerate the lockfile with `npm.cmd install --package-lock-only`, and run the posture checker.

## Targeted repair refuses to continue

The repair intentionally stops unless the sole unapproved report finding is `CVE-2026-49982` for `tmp@0.2.6`. Do not broaden an exception. Review `security-reports\trivy\repository.json`.

## Rollback

The targeted script stores `backend/package.json` and `backend/package-lock.json` under `backups\phase7-12-tmp-patch-v8-*` and restores them if installation, validation, image rebuilding, or health checks fail.
