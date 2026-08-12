# SalonAI Development Audit, Milestones and Roadmap

**Audit date:** 12 August 2026
**Source reviewed:** `SalonAI_V2(1).zip`
**Recommended next working branch:** `phase-8.4-public-team-profiles`
**Production impact of this package:** none — local development package only

---

## 1. Executive assessment

SalonAI has moved well beyond a basic salon booking application. The attached source contains a substantial MERN-based salon platform, a Python AI microservice, commerce and inventory features, customer CRM, communications, operational reporting, production deployment controls, observability, authentication hardening, and the more recent Phase 8 customer-conversion work.

The codebase is broadly healthy at the application-test level. The strongest immediate risks are not core application correctness; they are **Git synchronisation, source-archive hygiene, thin browser/E2E coverage, media-storage scalability, and a legacy public stylist endpoint that exposes more fields than a public client needs**.

This audit also implements a new development milestone: **Phase 8.4 — About, Public Team Profiles and Profile Photography**.

### Overall status

| Area | Assessment | Evidence |
|---|---|---|
| Backend JavaScript | PASS | 523 files passed source syntax check |
| Backend automated tests | PASS | 185/185 passed |
| Backend application import | PASS | Express application imported successfully |
| Frontend pure JS tests | PASS | 13/13 passed |
| AI service tests | PASS | 60/60 collected tests passed |
| Frontend production build in audit sandbox | NOT RE-RUN | Uploaded archive bundled Windows dependencies; audit environment is Linux |
| Git repository object database | PASS | `git fsck --no-reflogs` exited 0; dangling historical objects are not corruption |
| Git synchronisation | ACTION REQUIRED | local Phase 8.1 branch is not on GitHub and is based on a stale local `main` |
| Secret/archive hygiene | ACTION REQUIRED | uploaded ZIP contains local `.env` files/backups, `.git`, `node_modules`, `.venv` and build output |
| Stripe/Twilio code | READY FOR TEST | credentials were configured locally earlier; end-to-end test intentionally deferred |
| Public staff/profile development | IMPLEMENTED | About page, safe public team API, staff editor, customer profile photo, five demo staff |

---

## 2. Test evidence

### Backend

Final post-development checks performed against the extracted attached project:

- `node scripts/checkSource.js`
- Result: **523 JavaScript files passed syntax checking**
- Express `src/app.js` import: **passed**
- Node test suite: **185 tests**
- Passed: **185**
- Failed: **0**
- Skipped: **0**

During development, the new profile-media code initially exposed two real defects:

1. image `data:` URLs were being parsed as ordinary URLs before the image-data validator ran;
2. account normalisation always injected an empty `profilePhoto` field, which changed an established contract.

Both were corrected. The final 185-test suite passes.

### Frontend

Pure JavaScript tests were run without browser/runtime dependencies:

- roadmap feature tests
- CSV tests
- palette tests
- stylist utility tests
- new profile-media tests

Final result: **13/13 passed**.

A new profile-media test suite checks:

- initials used as avatar fallback;
- HTTPS/data-image acceptance;
- permitted image MIME types;
- source image size enforcement.

### AI service

`python3 -m pytest -q` passed. Collection shows **60 tests** across:

- customer segmentation;
- customer summaries;
- demand forecasting;
- haircare;
- health;
- management copilot;
- marketing insights;
- no-show prediction;
- sales forecasting;
- security.

The audit sandbox emitted a pytest cache-permission warning only; that is not a test failure.

### Frontend build portability finding

The uploaded ZIP contains Windows `node_modules`. Native Vite/Rolldown packages are platform-specific, so those dependencies are not a valid Linux build input. This is an **archive construction problem**, not evidence that the React source is broken.

The frontend production build must therefore be rerun on the user's Windows development machine after installing this Phase 8.4 package. The previous Windows production build before this new feature pass was already green.

---

## 3. Git synchronisation audit

### State embedded in the uploaded project

- Current local branch: `phase-8.1-session-resilience`
- Current local HEAD: `b8b9a29`
- Local `main`: `62cecfd21e24814e182b1e87d9aa24815322b42b`
- Embedded `origin/main`: also `62cecfd21e24814e182b1e87d9aa24815322b42b`
- Local Phase 8.1 branch: one commit ahead of that embedded/stale main.

### Live GitHub state checked during this audit

- GitHub default branch: `main`
- Live `main`: `50c96f39f62ba0e1349648be8f1f38c9957a3868`
- Live `main` is **11 commits ahead** of the archive's `62cecfd...` main and **0 behind** it.
- Remote branch `phase-8.1-session-resilience`: **not present**.
- Remote branch `phase-8-premium-experience`: present, but currently **19 commits behind `main` and 0 ahead**.

### Meaning

The local development work must **not** be pushed directly to `main` from its present state.

The safe path is:

1. install and validate Phase 8.4 locally;
2. remove temporary helper files that should not be committed;
3. create/continue a dedicated feature branch;
4. explicitly stage the intended Phase 8 files;
5. commit them locally;
6. `git fetch origin`;
7. rebase or merge the clean feature branch onto current `origin/main`;
8. resolve any conflicts;
9. rerun backend tests, frontend tests/build and smoke tests;
10. push the feature branch;
11. use a pull request into `main`.

The remote changes that account for the currently observed main-line drift are concentrated around production/deployment controls, including production smoke workflow and deployment-security scripts. This lowers the probability of a conflict with the profile/UI work, but it does not remove the need for a proper rebase/merge.

### Important line-ending observation

When the Windows repository was unpacked into a Linux audit environment, Git reported a very large number of apparent modified files. The user's actual Windows working tree previously showed only the expected Phase 8 files. This is consistent with CRLF/LF normalisation noise.

A future maintenance task should introduce a deliberate `.gitattributes` policy, but only in a clean branch and with a controlled one-time renormalisation. Do not mass-renormalise the current working tree before the Phase 8 integration is secured.

---

## 4. Source archive and secret hygiene

The uploaded archive is about **80 MB compressed** and approximately **267 MB uncompressed**. It contains:

- more than 26,000 `node_modules` entries;
- a Python virtual environment;
- `.git`;
- generated `dist` content;
- local `.env` files;
- production/local environment files;
- several `.env` backups created while configuring Phase 8.3;
- other local/runtime artefacts.

The actual Git index tracks only the normal `.env.example` files; the local secrets do not appear to be intentionally tracked. That is good, but they should still never be included in a source-sharing ZIP.

### Remediation added in Phase 8.4

A new script is included:

`scripts/dev/New-TrackedSourceArchive.ps1`

It:

- refuses to create an archive from a dirty Git working tree;
- uses `git archive HEAD`;
- exports tracked source only;
- excludes `.git`;
- excludes untracked `.env` secrets and backups;
- excludes `node_modules`;
- excludes Python virtual environments;
- excludes local build/runtime artefacts.

Use this after a clean commit rather than zipping the whole project folder in Explorer.

If the attached source ZIP has been distributed anywhere beyond a private development context, rotate credentials that were present in its `.env` files/backups. This audit did not print or package any secret values.

---

## 5. Bugs, weaknesses and development issues found

### P0/P1 — Git drift before release

**Status:** unresolved operational action.

The working branch is based on an out-of-date main reference and does not exist remotely. Release work must stop until the feature work is committed and synchronised safely with live `origin/main`.

### P1 — Source ZIP includes secrets and dependencies

**Status:** mitigated with new safe archive script; existing attached ZIP remains unsuitable as a distributable source package.

### P1 — Legacy public stylist endpoint returns broad stylist records

`GET /api/stylists` is public and existing management and booking screens share it. Stylist documents contain fields such as email, phone and working hours that public clients do not need.

**Phase 8.4 mitigation:** a separate safe endpoint is now available:

`GET /api/stylists/public`

It selects only public profile/team fields and is used by the new About page.

**Next correction:** separate management/private stylist retrieval from all public booking retrieval, migrate public consumers, and then ensure the legacy public endpoint never serialises private contact data.

### P1 — Stripe and Twilio are configured but not proven end to end

Configuration readiness is green from the previous local setup, but the final tests were intentionally deferred.

Before production activation, prove:

- Stripe Checkout creates a real sandbox Checkout Session;
- webhook signature validation succeeds;
- `checkout.session.completed` settles the order exactly once;
- asynchronous success/failure events behave correctly;
- a Twilio Sandbox participant receives a SalonAI message;
- free-form messages are blocked outside the 24-hour WhatsApp customer-service window;
- approved template messages work outside that window;
- opt-out/consent behaviour is recorded.

### P2 — Browser/E2E test coverage is much thinner than backend coverage

Backend test coverage is strong by count. Frontend automated coverage is currently mostly utility-level.

Add Playwright or an equivalent E2E suite for:

- registration/login/logout;
- refresh-cookie session restoration;
- forgot/reset password;
- services -> stylist -> slot -> booking;
- account/profile image update;
- staff self-profile edit/publish;
- About/team rendering;
- cart/Stripe sandbox checkout;
- WhatsApp flow;
- role/access controls;
- navigation/footer;
- responsive mobile flow.

### P2 — Profile images are stored as data URLs in MongoDB

Phase 8.4 intentionally uses a low-infrastructure MVP design:

- JPEG/PNG/WebP only;
- source file maximum 5 MB in the browser;
- image resized client-side to a maximum 720 px dimension;
- converted to JPEG;
- bounded data URL;
- server validates the image again;
- HTTP and SVG input are rejected.

This is acceptable for a limited number of avatars, but it is not the long-term media architecture.

Move to object storage/CDN before significant scale.

### P2 — Individual staff profiles are not yet public SEO pages

Staff can manage a public profile, and About can display it, but there is not yet a route such as:

`/team/maya-thompson`

That should be introduced in the later SEO phase.

### P2 — Five starter staff are demo data, not user login accounts

The package includes exactly five fictional stylist profiles, using reserved `.invalid` email addresses. No default passwords are created.

This is deliberate: production code must not ship shared/demo employee credentials.

To let a real staff member edit a profile:

1. create the staff User account using the normal admin workflow;
2. ensure the User email matches the relevant stylist record;
3. the staff self-profile endpoint links the profile safely;
4. the employee can then upload a photograph, edit public details and publish/unpublish the profile.

### P3 — SEO is currently metadata-level rather than full technical SEO

A client-side `Seo.jsx` already provides useful title/description/robots/canonical handling. Full search optimisation should be a later dedicated phase rather than mixed into the current profile work.

---

## 6. Phase 8.4 delivered in this package

### 6.1 About page

New public route:

`/about`

Includes:

- brand/about narrative;
- salon values;
- human + technology positioning;
- services/booking calls to action;
- public team section;
- loading/error/empty states;
- staff specialties and experience;
- public social links where supplied;
- accessible image alternatives;
- SEO metadata;
- navigation and footer links.

### 6.2 Five fictional starter employees

`backend/data/demo-stylists.json`

Profiles:

1. **Maya Thompson** — Senior Colourist
2. **Luca Romano** — Cutting Specialist
3. **Amara Okafor** — Texture & Curl Specialist
4. **Sophie Bennett** — Balayage & Styling Artist
5. **Daniel Kim** — Grooming & Precision Stylist

They are intentionally fictional. Their emails use `@salonai.invalid`.

A safe explicit seed command is included:

`npm run seed:demo-stylists`

The script upserts the five profiles by email. It does not create passwords or User login accounts.

### 6.3 Employee self-service public profile

New staff route:

`/staff/profile`

Authenticated stylist/manager/admin users can manage public-facing profile information:

- professional photograph;
- job title;
- biography;
- years of experience;
- specialties;
- languages;
- Instagram;
- Facebook;
- website;
- publish/unpublish status.

Private phone/email fields are not editable through this public-profile form.

### 6.4 Customer profile photograph

Customers can now:

- upload a profile photograph from Manage Account;
- replace it;
- remove it;
- save it with their User profile;
- see it in the customer account hero;
- see it in the logged-in navigation avatar.

### 6.5 Staff admin photo upload

The existing admin Stylist form now supports image upload instead of requiring only a manually pasted image URL.

### 6.6 Safe profile-media validation

Server and client both enforce the image contract.

Accepted:

- HTTPS image URL;
- JPEG;
- PNG;
- WebP.

Rejected:

- HTTP URL;
- SVG data URL;
- unsupported MIME type;
- oversized result.

### 6.7 Public team endpoint

New endpoint:

`GET /api/stylists/public`

It returns only team/public fields rather than the broader legacy Stylist representation.

### 6.8 Stylists public-navigation UX fix

The top navigation already exposes `/stylists`, but the old page expected a booking service to have been selected first.

It now has two modes:

- **browse mode** — visitors can browse/search all active stylists;
- **booking mode** — after selecting a service, the existing Step 2 booking flow continues.

### 6.9 Safer source archive utility

The new tracked-source archive script prevents recurrence of the attached ZIP hygiene problem after the repository is committed.

---

## 7. Development milestones achieved

### Foundation milestone

- MERN application structure;
- Express API;
- React/Vite frontend;
- MongoDB persistence;
- core authentication and roles;
- services;
- stylists;
- appointments.

### Salon operations milestone

- booking availability;
- customer CRM;
- notes/follow-ups;
- staff rota;
- staff management;
- daily close;
- capacity and operational dashboards.

### Commerce milestone

- products;
- inventory;
- suppliers and purchase orders;
- cart;
- checkout;
- order history;
- payment models;
- Stripe integration layer.

### Customer-experience milestone

- customer account;
- discovery preferences;
- loyalty/referral/gift-card concepts;
- communications;
- reminders;
- campaigns;
- retention journeys;
- customer experience suite.

### AI milestone

- haircare recommendations;
- customer segmentation;
- customer summaries;
- demand forecasting;
- sales forecasting;
- no-show prediction;
- marketing insights;
- management copilot.

### Production-readiness milestone

- Docker/Compose;
- production edge;
- TLS;
- deployment scripts;
- GitHub Actions;
- smoke tests;
- observability;
- backup/restore and operational controls;
- production v8 baseline.

### Phase 8.1 — session resilience

- split access/refresh secrets;
- refresh cookie;
- rotation;
- frontend refresh/retry;
- session restoration;
- password-change invalidation.

### Phase 8.2 — customer conversion

- forgot/reset password;
- public service catalogue;
- navigation/footer improvements;
- social/WhatsApp links;
- imported service catalogue.

### Phase 8.3 — payments and messaging activation

- Stripe webhook event handling;
- Twilio WhatsApp provider;
- 24-hour outbound messaging policy;
- one-off messaging controls;
- test-mode credential readiness.

### Phase 8.4 — About, team and profile media

Delivered by this package.

---

## 8. What to achieve next

## Phase 8.5 — Payments and Messaging End-to-End Acceptance

**Priority:** highest after Phase 8.4 installation.

Deliver:

- Stripe sandbox Checkout acceptance;
- signed local webhook acceptance;
- idempotent order settlement evidence;
- async payment evidence;
- Twilio Sandbox inbound/outbound evidence;
- consent and opt-out audit trail;
- WhatsApp status callbacks;
- payment receipt via email/WhatsApp;
- automated integration tests for provider boundaries.

**Exit criteria:**

- no mock-mode dependency in acceptance environment;
- successful sandbox payment;
- webhook handled exactly once;
- successful WhatsApp delivery;
- evidence recorded without secrets.

## Phase 8.6 — Production Media Service

Move profile and future portfolio images from Mongo data URLs to object storage.

Deliver:

- S3/R2/Cloudinary-compatible abstraction;
- signed upload flow;
- image MIME/magic-byte validation;
- maximum dimensions;
- metadata stripping;
- CDN URLs;
- thumbnail variants;
- delete/replace lifecycle;
- abandoned-upload cleanup;
- optional moderation;
- backup/data-retention policy.

**Exit criteria:** MongoDB stores media metadata/URLs, not image bodies.

## Phase 8.7 — Automated Quality Gate

Deliver:

- React component tests;
- Playwright E2E;
- accessibility tests;
- API contract tests;
- auth/role matrix tests;
- visual smoke tests for public/mobile pages;
- dependency/security scan in CI;
- secret scan;
- coverage thresholds;
- test evidence artifact uploaded by CI.

## Phase 8.8 — Public Profiles, Portfolio and Reviews

Build on Phase 8.4.

Deliver:

- public staff slug pages;
- staff portfolio/gallery;
- before/after images with explicit customer consent;
- verified reviews tied to completed appointments;
- stylist service specialties;
- consultation preferences;
- staff availability preview;
- shareable profile links;
- customer inspiration gallery;
- image consent and deletion controls.

## Phase 8.9 — Customer Growth and Retention

Deliver:

- favourites;
- saved stylists/services;
- rebook button;
- personalised home/dashboard;
- abandoned booking recovery;
- appointment reminders;
- referral attribution;
- loyalty wallet;
- gift cards;
- targeted offers;
- customer feedback/NPS flow;
- analytics events with privacy/consent controls.

---

## 9. Later Phase 9.0 — SEO and Organic Growth

SEO should be a dedicated engineering and content phase after the public product has stable routes and media.

### 9.1 Renderability and crawlability

The public application is currently React/Vite client-side rendered.

Evaluate and implement one of:

- static prerendering for public routes;
- server-side rendering;
- hybrid rendering.

Priority public pages:

- home;
- About;
- services;
- individual service landing pages;
- team;
- individual staff pages;
- shop/category/product pages;
- contact/location page.

Authenticated/management routes should remain excluded from indexing.

### 9.2 Technical SEO

Deliver:

- `sitemap.xml`;
- `robots.txt`;
- stable canonical URLs;
- unique titles/descriptions;
- Open Graph metadata;
- social sharing images;
- 404 handling;
- redirect policy;
- clean URL/slugs;
- breadcrumb structure;
- noindex for private routes;
- Search Console/Bing verification;
- crawl monitoring.

### 9.3 Structured data

Add schema appropriate to the real business information, including:

- HairSalon/LocalBusiness;
- Organization;
- Service;
- Product where applicable;
- BreadcrumbList;
- staff/person profile data where appropriate;
- review/rating markup only where eligibility and provenance requirements are met.

Never invent ratings, reviews, opening hours, prices, addresses or awards for search markup.

### 9.4 Local search

Deliver:

- consistent real salon name/address/phone;
- location/contact page;
- opening hours;
- map/location information;
- local service pages;
- booking calls to action;
- Google Business Profile alignment;
- local citation consistency.

### 9.5 Performance / Core Web Vitals

Focus on:

- image sizing and modern formats;
- responsive images;
- lazy loading below fold;
- critical public-page bundle size;
- route-level code splitting;
- font strategy;
- caching;
- CDN;
- layout stability;
- interaction latency.

The Phase 8.6 object-storage/media work should therefore precede full SEO optimisation.

### 9.6 Content architecture

Build useful, non-duplicative pages around real salon expertise:

- service explanations;
- consultation guidance;
- colour/cut/curl care;
- aftercare;
- stylist expertise;
- pricing expectations;
- FAQ;
- policies;
- real transformations with consent.

### 9.7 Measurement

Add privacy-aware analytics for:

- organic landing page;
- service view;
- stylist view;
- booking start;
- booking completion;
- shop purchase;
- WhatsApp booking click;
- phone/contact action.

Use conversion events to connect SEO work to bookings/revenue rather than rankings alone.

---

## 10. Recommended release sequence

1. Install Phase 8.4 package locally.
2. Run backend tests.
3. Run frontend pure tests.
4. Run frontend Windows production build.
5. Start backend/frontend and manually test:
   - About;
   - team cards;
   - five demo staff if seeded;
   - customer photo;
   - staff photo;
   - publish/unpublish;
   - stylists browse mode;
   - navbar/footer.
6. Do not seed fictional profiles into production unless they are intentionally wanted as placeholders.
7. Clean temporary Phase 8 helper files.
8. Create `phase-8.4-public-team-profiles`.
9. Explicitly stage intended files.
10. Scan staged diff for secrets.
11. Commit.
12. Fetch live GitHub.
13. Rebase/merge onto current `origin/main`.
14. Rerun full validation.
15. Push feature branch.
16. Open PR.
17. Complete Phase 8.5 sandbox Stripe/Twilio acceptance.
18. Only then prepare a new immutable production release.

---

## 11. Phase 8.4 acceptance checklist

- [ ] Package installed into Windows working copy
- [ ] Backend source check passes
- [ ] Backend 185 tests pass
- [ ] Frontend 13 pure tests pass
- [ ] Frontend production build passes on Windows
- [ ] `/about` loads
- [ ] About appears in navbar/footer
- [ ] public team endpoint does not expose email/phone
- [ ] demo stylist seed optionally creates/updates exactly five profiles
- [ ] customer can upload/replace/remove profile photo
- [ ] customer photo appears on account/navigation
- [ ] stylist can open `/staff/profile`
- [ ] stylist can upload/replace/remove photo
- [ ] stylist can publish/unpublish profile
- [ ] admin Stylist form supports image upload
- [ ] `/stylists` can be browsed without selecting a service
- [ ] existing booking flow still works with selected service
- [ ] `git diff --check` passes on Windows
- [ ] no `.env`/backup secret is staged
- [ ] feature branch synchronised with current `origin/main`
- [ ] no production deployment performed until explicit approval

---

## 12. Release recommendation

**Do not deploy this package directly to production yet.**

The application-level automated evidence is strong, and the new profile functionality is ready for local acceptance. The remaining release gates are:

1. Windows Vite build after installation;
2. manual/browser acceptance of the new UI;
3. Git branch synchronisation with current GitHub `main`;
4. staged-secret audit;
5. deferred Stripe/Twilio end-to-end acceptance.

After those gates, Phase 8.4 can be integrated cleanly and Phase 8.5 can close payments/messaging before the later media, QA and SEO phases.
