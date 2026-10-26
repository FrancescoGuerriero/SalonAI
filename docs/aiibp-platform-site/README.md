# AIIBP commercial platform website

This directory contains the standalone customer-facing website for the AI Intelligent Business Platform.

## Purpose

The site explains AIIBP as a modular multi-tenant SaaS platform that composes independently selectable business modules into a custom tenant product.

It is deliberately separate from any one tenant application so AIIBP can be marketed and documented as the platform provider rather than as a salon-specific product.

## Content authority

The website should remain aligned with:

1. `../AIIBP_PLATFORM_DOCUMENTATION.md`
2. `../MASTER_DEVELOPMENT_ROADMAP_v3.2.md`
3. `../architecture/business-module-boundaries.md`
4. `../../backend/src/platform/capabilities/capabilityRegistry.js`

The backend capability registry remains the machine-readable authority for module names, dependency rules, allocation status and supported verticals.

## Commercial terminology rule

Customer-facing content uses AIIBP-native terminology.

Implementation adapters, inspiration sources and internal vendor-specific architecture names must not be presented as platform modules or platform identity. External services may be named only when they are genuine customer-selectable integration targets in an integration catalogue or setup workflow.

## Files

- `index.html` — responsive commercial site
- `styles.css` — site design system and responsive layout
- `app.js` — navigation, module filtering and progressive motion

## Preview

The site is static and has no build dependency. Serve this directory with any static HTTP server or configure it as the source for a documentation/product-site deployment.

## Deployment options

Suitable deployment targets include:

- the AIIBP corporate domain;
- a documentation/product subdomain;
- a static hosting platform;
- GitHub Pages for non-production preview.

Production deployment should use the standard AIIBP domain, security headers, analytics/privacy configuration, accessibility review and release process.

## Acceptance checklist

Before publishing:

- verify desktop, tablet and mobile layouts;
- verify keyboard navigation and skip link;
- verify contrast and focus behaviour;
- confirm module names against the capability registry;
- confirm no internal engines are advertised as separate commercial modules;
- confirm no inspiration/implementation branding appears in public copy;
- confirm links and documentation paths;
- perform copy/legal/privacy review;
- run a representative customer comprehension review.
