# Phase 8.3 — Premium customer experience, account and design system

Date: 2026-08-06

## Outcome

This checkpoint replaces the former browser-only feature workspaces for points 12–31 with authenticated salon workflows and applies one restricted visual system across the application.

## Design and navigation

- The interface palette is restricted to gold, sand, black, white and neutral grey.
- Tailwind semantic colours and hard-coded chart/status colours are remapped to the approved palette.
- A source-level palette regression test prevents saturated red, green, blue, purple, pink or cyan values from returning.
- Public desktop navigation becomes a labelled burger drawer below 1024px.
- The drawer closes on route changes and Escape, locks background scrolling and exposes accessible expanded/control attributes.
- The shared footer now contains salon, account, home-address and privacy navigation.

## Account management

- `/account/manage` loads the authenticated account from the API.
- Customers can update their name, phone and structured UK home address.
- Only whitelisted fields are accepted; role, email, verification and administrative fields cannot be changed through the account endpoint.
- The saved address prefills delivery checkout and remains editable per order.

## Developed features 12–31

| Point | Feature | Operational result |
|---:|---|---|
| 12 | Privacy and Consent Centre | Server-side dated consent choices and customer JSON export. |
| 13 | Verified Reviews and Ratings | Completed-appointment verification, one review per visit, moderation queue. |
| 14 | Salon Favourites | Persistent live service, stylist and product favourites. |
| 15 | Offers and Promotions | Managed dated offers, limits, account claims and server-verified checkout discounts. |
| 16 | Gift Card Wallet | Code-hash lookup, recipient protection and masked balance display. |
| 17 | Loyalty Progress | Live balance, tier, progress and transaction history. |
| 18 | Appointment Self-Service | Owned future-appointment requests; manager approval performs guarded cancellation or availability-checked rescheduling. |
| 19 | Customer Inbox | Account-scoped notifications and read state. |
| 20 | Install SalonAI | Web manifest, branded icon, service worker and offline shell. APIs and payments are never cached. |
| 21 | Search Visibility | Route metadata, canonical URLs, robots rules and sitemap. Authenticated pages are no-index. |
| 22 | Analytics Transparency | Consent-linked explanation of essential and optional measurement categories. |
| 23 | Performance Diagnostics | Current-session navigation, transfer, resource and connection information. |
| 24 | Responsive Experience QA | Live viewport, orientation, touch and burger-navigation checks. |
| 25 | Quality Centre | Safe customer-shell smoke checks plus automated feature/palette tests. |
| 26 | Release Readiness | Honest running-build checks for version, HTTPS, API, manifest and environment. |
| 27 | Salon Discovery Preferences | Persistent postcode, travel, service, stylist, day and time preferences. |
| 28 | Digital Consultation | Consent-gated salon goals, treatment history and sensitivity records with management review. |
| 29 | Inspiration Board | Private HTTPS-linked hairstyle ideas and stylist notes. |
| 30 | Customer Referral Hub | Real referral creation, code copy and status tracking. |
| 31 | Product Feedback | Structured ratings, categories, follow-up consent and management triage. |

## Management workflow

The new `/customer-experience-management` workspace allows authorised salon-management users to:

- create, pause and activate promotions;
- approve or decline appointment-change requests;
- publish or reject verified reviews;
- mark consultations as reviewed;
- triage and resolve product feedback.

## Security and privacy controls

- All customer-experience endpoints require authentication.
- Management endpoints require a salon-management role.
- Appointment and review actions verify ownership through the linked customer profile.
- Inspiration URLs require HTTPS.
- Gift-card secret codes are hashed for lookup and never returned to the frontend.
- Consultation storage requires explicit consent.
- The service worker bypasses every `/api/` request.
- Profile updates use a strict field allowlist.

## Validation

- Backend source check and application import: passed.
- Backend unit and route regression suite: 149 passed.
- Frontend roadmap, palette and stylist contract tests: 7 passed.
- Frontend production build: passed.
- AI-service regression suite: 60 passed.
- `git diff --check`: passed.

No production data, Git commit or deployment is included in this checkpoint.
