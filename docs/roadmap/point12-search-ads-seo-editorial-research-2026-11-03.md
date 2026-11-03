# AIIBP Marketing — Search, Ads, SEO & Editorial Outreach Implementation Specification

**Research date:** 2026-11-03 (UK)  
**Planning status:** Owner-requested Marketing priority; research and implementation specification, not production integration acceptance  
**Module owner:** Existing commercial `marketing` module (no new module)  
**Roadmap basis:** `docs/MASTER_DEVELOPMENT_ROADMAP_v3.3.md`; owner deferred Tenant Provisioning / 22-module assignment, not cancelled.  
**Existing issue:** #574, Technical SEO / Search deliverables.

## 1. Scope and safe sequence

Build a unified **Search & SEO Operations** capability *within Marketing* with tabs for Overview, Technical SEO, Search Console & Bing, Content Library, Editorial Outreach & Backlinks, Ads & Conversions, and AI Search Visibility. Keep the existing Marketing Data Hub, CRM, Communications and Analytics authorities; do not create duplicate core modules, parallel provider tokens or another marketing data store.

The first executable slice is **tenant-scoped read-only SEO inventory/auditing** using the existing `technicalSeoCrawler.js`, plus a content/outreach planning contract. Subsequent provider operations must reuse the existing IntegrationConnection credential store and managed/native connection model. Provider connections, background jobs, remote submissions and paid advertising changes stay off unless a non-production test tenant and explicit approvals exist.

## 2. Current platform findings

- `frontend/src/config/providerConnectionRegistry.js` declares Google Ads, Microsoft Advertising, GA4, GTM, Google Search Console and Bing Webmaster as P0; registration is **not evidence of a live connection**.
- `backend/src/features/integrationPlatform/technicalSeoCrawler.js` already supports a bounded, same-origin HTTPS HTML SEO crawl, title/H1/description/canonical/noindex and internal-link observations with SSRF protections. Reuse it; extend the audit contract instead of writing a second crawler.
- `backend/src/features/integrationPlatform/marketingOrganicProviderAdapters.js` and advertising/verified connector adapters already provide native/managed retrieval foundations; inspect exact supported profiles and provider fields before extension.
- Point 12 Marketing B–N is source baseline complete; non-production provider, browser, consent and attribution acceptance remain pending.
- The portfolio remains 22 commercial modules. The SEO/outreach library and scheduling are **Marketing features**, not extra modules.

## 3. Ranked implementation backlog

| Priority | Capability | Specific deliverables | Acceptance |
|---|---|---|---|
| P0.1 | SEO site and URL inventory | Verified Business-owned HTTPS domains; Location association where relevant; route/content-type discovery; indexable vs protected pages; page identity, canonical and crawl status | Tenant A/B domain isolation; no private URLs; SSRF/redirect safety; bounded page count and time |
| P0.2 | Technical SEO audit and recommendations | Reuse crawler; sitemap & robots inspection; broken links/redirect chains; metadata/H1; duplicate and conflicting canonical; robots/noindex; JSON-LD validity; mobile/rendering checks; accessibility/performance evidence | Deterministic issues with evidence, severity, date, URL; no arbitrary SEO score masquerading as Google ranking |
| P0.3 | Google Search Console reporting | OAuth account/site ownership; Search Analytics by query/page/device/country; URL Inspection sampling; sitemap list/submit only with explicit owner action; 28/90-day comparisons and query-to-landing-page gaps | Native-vs-import reconciliation, quotas, scoped site ownership, source provenance |
| P0.4 | Bing Webmaster + IndexNow | Read-only performance/keywords/crawl/link reporting via **REST** API (legacy SOAP/POX retired Aug 31 2026); owned-host IndexNow key proof and bounded submit queue for genuinely changed approved public pages only | Correct ownership; idempotent queue; rate limits; 200=received, not indexed; failed submission retry evidence |
| P0.5 | Search-visible publishing correctness | Approved public service/location/product/article pages; dynamic sitemap and lastmod on real changes; robots boundaries; server-visible metadata; Article/Organization/LocalBusiness/Breadcrumb/Product markup only where semantically appropriate and verified | Crawlable rendered HTML; correct canonicals; noindex private/staging/account pages; Search Console/Bing inspection |
| P0.6 | Paid search measurement | Google Ads API **v26.1** / Microsoft Ads reporting; campaigns, ad groups/assets, spend, clicks, impressions, conversions, CPA/ROAS, destination URLs; UTM/GCLID/MSCLKID capture, consent and booking/order/revenue matching | Read-only import, provider reconciliation, no double-counting, Business/Location separation |
| P0.7 | Consent-aware conversions | GA4/GTM reports, Google Ads conversion action mapping; Microsoft UET + CAPI where eligible, shared eventId for dedupe, server/browser consent handling; auditable event schema | Attribution and conversion totals reconciliation; consent gating; no unsolicited pixels or data exports |
| P1.1 | Content pool / editorial library | Canonical published article URL, tenant-owned domain, title, author, topic cluster, language, target audience, originality/source rights, published/updated dates, featured image, consent/editorial approval, reusable excerpts, outreach constraints | No unowned articles, duplicates, or fabricated authors; verified live canonical URL, review status, version and content fingerprint |
| P1.2 | Monthly editorial/backlink campaign | Monthly planning cadence; select approved articles; discover relevant independent outlets, partners and professional associations; manually review prospect fit; prepare unique pitches or substantially original guest pieces; schedule follow-ups only with outreach consent | Per-tenant outreach ledger, evidence of human approval and recipient suitability, opt-out/suppression, no unapproved mass publication |
| P1.3 | Article submission workflow | Publisher-specific submission profile and permitted channel (API/RSS/email/form/manual); editorial standards; origin article provenance; rights/license; embargo/date; disclosure/sponsored flags; submission state + accepted/rejected/live URL | Only explicitly permitted mechanisms; no CAPTCHA bypass, publisher scraping/account creation or self-generated link networks |
| P1.4 | Backlink discovery & health | Import Bing link data or approved licensed third-party provider; track source page, target canonical, anchor, link rel (nofollow/sponsored/ugc), first/last seen, HTTP status, referral sessions and acquired/lost; recheck monthly | Link verified before 'earned' credit; disclose partial provider coverage; distinguish placements from raw links; no guaranteed ranking claims |
| P1.5 | Local SEO / AI search visibility | Verified Business/Location NAP consistency, hours and categories; structured entities; Google Search Console AI-feature data where available; Bing AI Performance (citations, cited pages, intents/topics), Topics Portfolio beta as UI/manual or supported feed; referral attribution | Provider/API capability flags; no invented Google/Bing/Copilot/ChatGPT ranking or unsupported automated API |
| P2 | Ads optimisation recommendations | Google AI Max Search term/headline/landing page performance, PMax assets, Microsoft PMax, negative/irrelevant query recommendations, landing page performance, budget pacing and anomaly alerts | Advisory mode first; campaign/bid/budget/creative mutations separately approved with dry-run, audit and rollback |
| P2 | SEO prioritisation / Core Web Vitals | PageSpeed/CrUX measurements as available; templates, image size, LCP, INP, CLS and high-conversion landing pages; prioritise issues by impact and evidence | Distinguish lab vs field data, age and origin; no unsupported 'guaranteed first-page' predictions |

## 4. Monthly backlinks and article-submission product design

**Monthly is the planning/reporting cadence, not an entitlement to guaranteed placements.** An example campaign:

1. On the first business day, produce a **monthly draft plan** from a Business-owned pool of approved, already published articles. Topic diversity, freshness, target intent and source rights are checked. No automatic publication or external outreach occurs.
2. Build a shortlist of relevant *independent* sites: trade publications, supplier/partner publications, specialist blogs, local associations, industry directories with genuine editorial criteria. Record publisher, domain, topical match, editorial contact/source, editorial guidelines and permission to approach. Prefer relevance and readership over arbitrary domain authority.
3. Assign a distinct proposed pitch and/or unique value-add article to each prospect. Existing articles can be cited as factual sources; do not spin near-identical content across sites solely to generate links.
4. Require human review of outreach and publisher terms. External send is through the canonical Communications module if accepted; no direct automated third-party posting to obtain links. Publisher submission/API automation is allowed only for publisher-approved channels and explicitly granted credentials.
5. Track draft → reviewed → sent → acknowledged → accepted → published → verified → declined/expired, with the published URL, canonical status, link target and link qualification. Validate `rel="sponsored"` for paid/advertorial links; label `nofollow` and `ugc` accurately.
6. Monthly follow-up/health report: genuine referring domains, verified links, placement relevance, newly gained/lost links, referral traffic, engaged visitors, leads/bookings/order revenue and unfulfilled outreach. Do not promise a fixed monthly link count or rankings.

**Article pool identity**: `businessId, originDomainId, canonicalUrl, articleId, title, topicCluster, author, contentHash, publicationRights, firstPublishedAt, modifiedAt, approvalStatus, language, status, targetKeywords, recommendedLandingPage`. A tenant may have multiple verified websites; cross-tenant pooling is disabled by default. Any licensing/cross-tenant reuse would require a separate, explicit rights contract.

**Outreach ledger**: `businessId, month, articleId, prospectDomain, contactSource, pitchVersion, permissionEvidence, status, reviewerId, reviewedAt, outreachChannel, submissionReference, destinationUrl, canonicalPolicy, linkRel, targetUrl, liveCheckAt, referralEvidence, idempotencyKey`. Separate publisher content reuse rights from any rights to contact or syndicate.

**Syndication guidance**: Publishing the same article on multiple domains does not inherently generate useful links. Google says cross-site `rel=canonical` is **not its preferred solution for syndicated content**; publishers seeking to avoid duplicates should normally block indexing of reprints. Editorially unique contributions are generally preferable. Paid placement must be disclosed and qualifying link attributes used. Do not build a private blog network, automated directory submitter, bulk link exchanges, ranking-credit paid links, scraper or spun article farm.

## 5. Google and Microsoft provider capabilities to prioritise

**Google Search Console**: Search Analytics, Sitemaps, Sites and URL Inspection are the documented APIs. Search Console does not expose an official comprehensive backlink export endpoint in this API surface. The Google Indexing API is **not** a general SEO indexing tool: it is restricted to eligible JobPosting/BroadcastEvent-in-VideoObject pages. For ordinary pages use crawlable HTML, sitemaps and supported Search Console workflows.

**Google Ads API**: `v26.1` released 2026-10-28; build versioned, tested read-only ingestion with migration/deprecation handling. Analyse AI Max Search `ai_max_search_term_ad_combination_view` and other supported search/landing-page reports; distinguish campaign review from changes to bidding, budget, URL expansion and generated assets. Support optional PMax/Demand Gen reporting after baseline Search. Do not auto-enable AI Max or create ad spend.

**Microsoft Advertising**: Performance Max is documented as open beta; implement campaign performance and UET conversion evidence first. Microsoft Conversions API supports server-side conversion/CRM/offline event ingestion; Microsoft recommends UET + CAPI together when appropriate, using shared `eventId` to deduplicate. Consent and account-specific access must be validated before sending.

**Bing Webmaster**: use supported REST APIs for search/crawl/link details and allowed site submissions. Legacy SOAP/POX retired 2026-08-31. IndexNow proves ownership with a per-host key and pushes changed URLs; receipt does not guarantee crawl or index. Bing AI Performance dashboard exists, with citation information and preview/beta topics features; do not invent API export support where none is documented.

**GA4/GTM/consent**: use the GA4 Data API for reports and property metadata, reuse GTM only behind existing tenant connections, and preserve valid user consent before any client/server tagging. Core Web Vitals, query/campaign/revenue reconciliation and attribution should expose data freshness and provenance.

## 6. Security, isolation, and abuse controls

- Enforce `marketing` entitlement + effective user permissions + active Business, selected/allowed Locations on every endpoint and scheduled job. Owner domain verification must be separate from a user-entered URL.
- Crawl only approved public hosts; use existing same-origin, HTTPS, DNS, private-network, redirect, timeout, maximum bytes and rate-limit protections. Reject localhost, redirects off-host and DNS rebinding; keep robots and editorial usage compliance.
- Store provider and publisher API secrets only server-side; never expose them in browser bundle or logs.
- Draft and preview by default. Separate permissions for SEO read, content authoring, editorial approval, third-party submission, ads reporting, and ads mutation. No autonomous external posting, sending, ad spend or backlink acquisition.
- Limit article selection and campaigns by quality/relevance and publisher consent, not a volume target. Log submission state, reviewer and publisher responses; respect unsubscribe and suppression.
- Do not promise ranking increases or guarantee placement, indexing or traffic. Distinguish predictions and AI suggestions from observed provider reports.
- Reuse existing Marketing Data Hub source ingestion, job scheduling/idempotency, analytics/attribution and Core AI read-only governance. Provider-native links and publisher acceptance must be separately verified.

## 7. Implementation slices and exit gates

**Slice S1 — SEO visibility/readiness**: read-only tenant/domain audit via existing crawler; public route inventory; canonical/robots/sitemap/structured data verification; deterministic issues; no new provider credentials. Tests for Business A/B, Location A/B, malicious URL/redirect, huge page, private page/noindex, invalid structured data, revisioned evidence. *Exit*: secure test-site scan and reproducible recommendations.

**Slice S2 — Search engine evidence**: Google Search Console and Bing Webmaster REST read-only integration, verification and quotas; IndexNow enqueue for real changed approved public URLs with explicit owner activation. *Exit*: nonprod provider-native reconciliation and URL ownership gates.

**Slice S3 — Ads & conversions**: Google v26.1 / Microsoft Ads reporting, GA4/GTM, consent, UET/CAPI where enabled; source-to-booking/order/revenue attribution; AI Max/PMax recommendations read-only. *Exit*: no double counts, account-isolation tests, explicit consent and provider evidence.

**Slice S4 — Article pool and monthly earned links**: articles registered from verified tenant sites, originality and rights checks, monthly planning, publisher list, editorial approvals, submission history and backlink verification. *Exit*: user-authorised editorial submission flow on an approved destination, no mass link-generation; monthly health report.

**Slice S5 — AI search and optimisation**: Bing AI citation evidence and Search Console reporting, topic opportunities, content refresh and landing-page recommendations. *Exit*: all metrics traceable to a documented provider/source, no fake indexing or guaranteed citations.

## 8. Source-of-truth links (verified 2026-11-03)

- Google Search spam policies: https://developers.google.com/search/docs/essentials/spam-policies
- Google Search canonical/syndication guidance: https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting
- Google Search Console API: https://developers.google.com/webmaster-tools/v1/api_reference_index
- Google Indexing API eligibility: https://developers.google.com/search/apis/indexing-api/v3/using-api
- Google Search Article markup: https://developers.google.com/search/docs/appearance/structured-data/article
- Google SEO for generative AI (2026): https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Google Ads API releases (v26.1): https://developers.google.com/google-ads/api/docs/release-notes
- Google AI Max reporting: https://developers.google.com/google-ads/api/docs/campaigns/ai-max-for-search-campaigns/ai-max-reporting
- Bing Webmaster REST/API: https://learn.microsoft.com/en-us/bingwebmaster/
- IndexNow API: https://www.indexnow.org/documentation
- Microsoft Performance Max: https://learn.microsoft.com/en-us/advertising/guides/performance-max
- Microsoft Ads CAPI: https://learn.microsoft.com/en-us/advertising/guides/uet-conversion-api-integration
- Bing AI Performance: https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/
- Bing Topics Portfolio beta (2026-10-13): https://blogs.bing.com/webmaster/2026/10/introducing-topics-portfolio-beta-in-ai-performance/
- GA4 Data API: https://developers.google.com/analytics/devguides/reporting/data/v1
- Google Tag Manager consent: https://developers.google.com/tag-platform/tag-manager/server-side/consent-mode

## 9. Delivery status

This commit is **research / backlog specification only**; no external backlinks have been acquired, no publisher submission sent, and no Google/Microsoft/Bing Ads campaigns or search indexing submissions activated. Next commit should deliver S1 implementation and tests, not claim S2–S5 are complete.
