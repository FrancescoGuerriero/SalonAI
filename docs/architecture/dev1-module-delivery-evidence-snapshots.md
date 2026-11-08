# DEV1 — Verified source/CI evidence in Module Management dashboard

Status: source-only. **No production deployment or module activation.**

## Evidence semantics

The module dashboard from PR #599 now links selected source work to the
27 requirements and 21 candidates from the uploaded `03_module_catalogue.md`.
The review was performed on **2026-11-08**, against GitHub PR metadata and
successful workflow runs. Evidence records contain the PR URL, merge commit,
workstream description, explicit mapped requirement IDs and, where the exact
PR-head checks were verified, the check names and head SHA.

`relatedSourceWorkMerged === true` means **some related source work** was
merged. It does **not** mean a requirement or deployable module is complete.
`recordedCiSuccess === true` means only the explicitly listed check(s)
succeeded on the recorded PR head. Historical evidence has a review date,
not an implied claim of current or continuous test success.

At this stage there is **no independently verified deployment, runtime
acceptance, provider activation or production acceptance evidence**. These
fields stay `null`/unknown regardless of PR status, CI or taxonomy mapping.
No endpoint is exposed that can set or change them.

## Verified evidence mapping

- Requirement 14 and candidate MKT-06: editorial/backlink PR #586.
- Requirement 16: audited read-only appointment metrics PR #591.
- Requirement 18: centrally governed AI PRs #589, #590, #591.
- Candidate CORE-02: tenant composition PR #592 and catalogue/dashboard
  PRs #598, #599.
- AI-CORE-01/02: relevant AI policy, metrics and audit source PRs.
- PR #597 records the **removal** of the unplanned AI monthly quota; it
  never counts as a newly enabled feature.

Records without separately rechecked PR-head CI are explicitly limited
to verified merged-source evidence.

## Integration and safety

- Read-only `GET /api/system-administration/module-catalogue` retains
  existing authentication and `feature-control:read` backend RBAC.
- The frontend route retains its separate permission guard.
- The delivery ledger is immutable, requires known catalogue IDs,
  and references only the canonical GitHub repository. Client-provided
  URLs or assertions are never accepted.
- No new runtime API token, GitHub credential, background sync,
  subscription, quota, provider connection, module activation or
  production mutation is added.

## Next acceptance slices

1. Server-verified current release and deployment evidence, connected to
   a specific commit, environment, tenant and location.
2. Trusted tenant-owned capability/entitlement and runtime health evidence;
   isolate business-scoped data by effective authority.
3. Separate operator-reviewed acceptance evidence with audit attribution,
   policy checks and expiration/review lifecycle.
4. Cross-tenant and authenticated browser tests, with future/stale/failed
   evidence remaining unknown or blocked, never inferred as passed.

DEV1 remains sole implementation owner.
