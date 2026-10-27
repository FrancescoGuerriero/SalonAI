# AIIBP Commercial Website

This directory contains the standalone public website for the **AI Intelligent Business Platform (AIIBP)**.

It is intentionally separate from tenant storefronts such as SalonAI. A tenant installation can keep its own public/customer experience while AIIBP retains a platform-level commercial website.

## Pages

- `index.html` — AIIBP platform proposition and composition model
- `modules.html` — all 22 commercial modules
- `about.html` — platform architecture, internal engines and core AI capabilities
- `contact.html` — platform-discovery / commercial enquiry UI
- `styles.css` — responsive AIIBP website styling
- `brand-data.css` — web-optimised AIIBP logo asset
- `site.js` — lightweight public-site interaction

## Commercial navigation

The Modules mega-menu lists every commercial module:

1. Appointments & Booking
2. Workforce & Staff
3. Service Catalogue
4. Commerce & Payments
5. Memberships
6. Inventory & Purchasing
7. Loyalty & Rewards
8. Communications
9. Calendar Integration
10. Integration Hub
11. CRM & Customer Intelligence
12. Analytics & Business Intelligence
13. Marketing
14. AI Business Adviser
15. AI Receptionist
16. AI Retention Manager
17. AI Stylist Copilot
18. Clinical Records
19. E-commerce & Online Store
20. Business Planning & Forecasting
21. Customer Experience
22. Seller & Marketplace Management

## Contact form

The form is deliberately UI-only until a production enquiry endpoint is selected. During deployment, connect it to a governed AIIBP public enquiry endpoint with spam protection, consent/audit controls and an approved destination mailbox/CRM workflow.

## Branding

The supplied AIIBP logo has been web-optimised and embedded in the site branding so this source package does not depend on tenant assets.

## Product-language rule

The commercial website describes AIIBP capabilities generically. It must not expose implementation-inspiration/vendor references as AIIBP product branding.
