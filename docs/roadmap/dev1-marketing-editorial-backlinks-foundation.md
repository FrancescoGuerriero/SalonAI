# DEV1-MKT-01 — Editorial placements and backlink evidence API

Status: PR #586 under review; source only. DEV1 is the sole implementation, integration, test and release owner. No live outreach, publishing, crawling, provider activation or deployment.

## Authority and ownership
- Roadmap: #574 (SEO/public acquisition), #237 (Marketing Data Core / Data Hub).
- Each new record is owned by the trusted `Business` and selected `Location`.
- Existing `ContentPage` remains the article authority. Editorial placements optionally reference it; no duplicate article store is introduced.
- The API resolves the authenticated user's trusted tenant context and effective authority server-side. Client-supplied business/location identifiers are ignored.
- Existing `customer-experience:read/manage` permissions govern editorial records; `reports:read/manage` govern backlink evidence. Dedicated marketing grants should be reconciled with the RBAC roadmap before general rollout.

## API (all require authentication and a selected effective location)

| Method | Path | Permission | Action |
|---|---|---|---|
| GET | /api/marketing-editorial/editorial-placements | customer-experience:read | Read scoped placements |
| POST | /api/marketing-editorial/editorial-placements | customer-experience:manage | Create a prospect |
| POST | /api/marketing-editorial/editorial-placements/:id/transition | customer-experience:manage | Review-controlled state transition |
| GET | /api/marketing-editorial/backlinks | reports:read | List manual/provider backlink evidence |
| POST | /api/marketing-editorial/backlinks/manual | reports:manage | Record *unverified* backlink evidence |
| GET | /api/marketing-editorial/backlinks/monthly?month=YYYY-MM | reports:read | Monthly observation report |

## Workflow
- prospect -> draft -> review -> approved -> submitted -> accepted -> published.
- Rejected, reverted and withdrawn transitions are constrained by the service state graph.
- Approval requires an authenticated approver, explicitly confirmed article rights and originality review.
- A published editorial placement requires a published HTTPS URL on the declared publisher host or a subdomain.
- Submission and publication transitions require explicit human confirmation and only record externally completed actions; they do not initiate any network request.
- Each state transition records the authenticated actor, previous/new status, UTC event timestamp and confirmation classification in per-placement history.
- Reported publication is human-attested, not a verified external backlink or search-indexing claim.
- Manually recorded backlinks always begin with `observed`, not `verified`.
- Monthly counts represent observations within the UTC calendar month and do **not** assert live backlinks, placement ranking impact, or search engine indexation.

## Release gates
1. Backend `npm test`, Fast CI and CodeQL green.
2. Business/location isolation verified with seeded tenants and negative tests.
3. Permission mapping and feature entitlement checked against current tenant plans.
4. Manual data entry validated in the integrated Marketing UI.
5. Separate future approval for verified provider imports, remote crawling, CMS publishing, outreach and scheduled monthly jobs.
6. Explicitly authorised release and production deployment after the standard DEV1 gate.

No credentials, production data migration or worker flags are modified by this package.

## AIIBP v3 delivery ownership

**Sole development lane: DEV1.** DEV1 owns implementation, UI, backend, AI integration coordination, SaaS/tenant enforcement, tests, provider acceptance, release and deployment for this package and subsequent v3 workstreams. The former DEV2, DEV3 and DEV4 functional lanes are not separate delivery dependencies for this plan. Specialist security, legal or regulated-domain sign-off remains a gate where applicable and does not create a separate development team.

No v3 expansion or broad rebranding is included in PR #586; AIIBP is the target platform identity and existing internal identifiers remain unchanged until a backward-compatible migration is accepted.
