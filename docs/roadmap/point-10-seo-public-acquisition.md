# Point 10 — SEO and Public Acquisition

Authority: numbered DEV1 development plan, Point 10.  
Issue: #574.  
Reference vertical: SalonAI.

## Reconciliation

Point 10 starts from the SEO foundation already present on `main` rather than recreating it. Existing canonical/meta handling, robots/noindex rules, static sitemap, search-verification hooks, acquisition landing pages, privacy-controlled tracking and Marketing Data Core integration remain authoritative.

## First tranche — verified local structured data

The first Point 10 tranche hardens search structured data without inventing public business facts.

`StructuredData.jsx` now emits:

- `Organization`;
- `WebSite`;
- route-specific `WebPage`;
- `BreadcrumbList` for eligible public child routes;
- `HairSalon` + `LocalBusiness` only when an explicit public salon address has been configured.

The local-business entity may include configured public name, postal address fields, telephone, Google Business/Maps URL and social profile URLs. It does not infer or fabricate opening hours, aggregate ratings, reviews, prices or credentials.

## Public configuration

The frontend environment contract now documents:

- `VITE_SALON_NAME`;
- `VITE_SALON_ADDRESS` (legacy full-address fallback);
- `VITE_SALON_STREET_ADDRESS`;
- `VITE_SALON_LOCALITY`;
- `VITE_SALON_POSTAL_CODE`;
- `VITE_SALON_COUNTRY_CODE`;
- `VITE_SALON_PHONE`;
- `VITE_GOOGLE_BUSINESS_URL`;
- existing public social profile URLs.

These values are deliberately treated as public data and must be populated only with verified business facts.

## Remaining Point 10 work

1. Service/stylist/product public entity pages, canonical slugs and entity-specific SEO/JSON-LD.
2. Dynamic sitemap coverage for canonical public entities/content.
3. Renderability/prerendering for search-critical routes.
4. Core Web Vitals, image/CDN optimisation, caching, route splitting and layout-stability acceptance.
5. Local-search profile alignment and ownership/readiness evidence.
6. Privacy-aware acquisition -> booking/revenue measurement into the Marketing Data & Attribution Core.

## Safety

Private/admin/account routes remain noindex. No production DNS, Search Console, Bing Webmaster or Google Business Profile mutation is performed by this tranche. No production deployment is authorised by Point 10 implementation alone.
