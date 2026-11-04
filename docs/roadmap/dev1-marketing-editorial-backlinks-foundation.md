# DEV1-MKT-01 — Editorial placements and backlink evidence API

Status: draft PR; source only. No live outreach, publishing, crawling, provider activation or deployment.

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
- A published editorial placement requires a published HTTPS URL.
- Submission and publication transitions only record externally completed human actions; they do not initiate any network request.
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
