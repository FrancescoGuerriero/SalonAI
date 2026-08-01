# SalonAI Phase 7.12 Dependency Maintenance

Phase 7.12 keeps dependency findings visible while allowing only narrowly scoped, expiring exceptions.

## Current controls

- `tmp` is forced to version `0.2.7` or newer in the backend lockfile.
- The release gate retains an unfiltered Trivy repository baseline.
- Only the exact legacy `brace-expansion@1.1.16` and `react-router@7.18.1` findings are excepted.
- Source checks prohibit direct backend use of the legacy glob chain and unstable React Router RSC APIs.
- Both exceptions expire on 14 August 2026.
- Any other HIGH repository finding blocks release.

## Standard verification

Run `scripts\verify-phase7-12.ps1` from PowerShell with the project root.
