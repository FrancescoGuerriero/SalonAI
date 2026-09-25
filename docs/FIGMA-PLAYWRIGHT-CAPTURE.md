# SalonAI → Figma Playwright Capture

This utility captures a rendered SalonAI page into the shared **AI Intelligent Business Platform — UX/UI Design System** Figma file using the Playwright installation that already exists in the frontend.

## Purpose

Use it to create production/reference screens for:

- DEV1 implementation and production-parity checks.
- DEV2 UX, HCI, responsive and accessibility review.
- DEV3 dashboard, employee, staff and RBAC workflow review.
- DEV4 reusable SaaS, tenant and vertical UX extraction.

The capture test is intentionally skipped during normal `npm run test:e2e` runs unless `FIGMA_CAPTURE_ID` is provided.

## Local/reference capture

From `frontend`, obtain a single-use Figma capture ID, then run the capture test against a local route. The normal Playwright webServer configuration builds and serves the Vite application automatically.

### PowerShell

```powershell
$env:FIGMA_CAPTURE_ID="<capture-id>"
$env:FIGMA_CAPTURE_PATH="/services"
npm run figma:capture
```

### Git Bash

```bash
FIGMA_CAPTURE_ID="<capture-id>" \
FIGMA_CAPTURE_PATH="/services" \
npm run figma:capture
```

## Production/public capture

Use a fully-qualified URL when the exact deployed screen is required.

### Privacy requirement

Production-reference captures of `salonai.francescopicardi.co.uk` automatically enable PII redaction before anything is submitted to Figma. This cannot be disabled for the production hostname.

The redaction pass masks discovered customer names, email addresses, UK mobile numbers, customer-profile links and elements explicitly marked with `data-figma-pii`. On the AI Customer Summaries route it also discovers customer identity values from the customer chooser and removes those values wherever they appear in the rendered page.

If any discovered sensitive value remains after redaction, the Playwright test fails **before** the single-use Figma capture ID is submitted.

Real customer data must never be exported intentionally to Figma, screenshots, design-review documents or other UX artifacts. Authentication and authorization must remain unchanged; masking happens only in the temporary browser DOM used for the design capture.

### PowerShell

```powershell
$env:FIGMA_CAPTURE_ID="<capture-id>"
$env:FIGMA_CAPTURE_TARGET_URL="https://salonai.francescopicardi.co.uk/services"
npm run figma:capture
```

### Git Bash

```bash
FIGMA_CAPTURE_ID="<capture-id>" \
FIGMA_CAPTURE_TARGET_URL="https://salonai.francescopicardi.co.uk/services" \
npm run figma:capture
```

## Authenticated production screens

Never commit credentials, cookies, tokens or Playwright storage-state files.

Create an authenticated browser storage state locally:

```bash
npx playwright codegen --save-storage=playwright/.auth/salonai-production.json https://salonai.francescopicardi.co.uk/login
```

Log in in the opened browser, then close the browser to save the state. Capture an authenticated page using:

### PowerShell

```powershell
$env:FIGMA_CAPTURE_ID="<capture-id>"
$env:FIGMA_CAPTURE_TARGET_URL="https://salonai.francescopicardi.co.uk/dashboard"
$env:FIGMA_CAPTURE_STORAGE_STATE="playwright/.auth/salonai-production.json"
npm run figma:capture
```

### Git Bash

```bash
FIGMA_CAPTURE_ID="<capture-id>" \
FIGMA_CAPTURE_TARGET_URL="https://salonai.francescopicardi.co.uk/dashboard" \
FIGMA_CAPTURE_STORAGE_STATE="playwright/.auth/salonai-production.json" \
npm run figma:capture
```

The `playwright/.auth/` directory is ignored by Git.

## Optional controls

- `FIGMA_CAPTURE_SELECTOR` — CSS selector to capture; defaults to `body`.
- `FIGMA_CAPTURE_EXPECT_ROUTE` — required route to verify before submission (for example `dashboard`, without a leading slash). The runner normalizes it to `/dashboard` internally. If authentication redirects to `/login`, the test fails before consuming the Figma capture ID.
- `FIGMA_CAPTURE_DELAY_MS` — additional rendering wait; defaults to 1500 ms.
- `FIGMA_CAPTURE_WIDTH` — viewport width; defaults to 1440.
- `FIGMA_CAPTURE_HEIGHT` — viewport height; defaults to 1000.
- `FIGMA_CAPTURE_STRIP_CSP=false` — disable the capture utility's CSP-header stripping.
- `FIGMA_CAPTURE_REDACT_PII=true` — enable the same DOM-level PII masking for local/staging captures. Production captures enable redaction automatically regardless of this setting.
- `FIGMA_CAPTURE_SUBMISSION_TIMEOUT_MS` — maximum wait for the Figma capture POST to complete; defaults to 360000 ms (6 minutes).
- `FIGMA_CAPTURE_TEST_TIMEOUT_MS` — overall Playwright test timeout; defaults to 420000 ms (7 minutes).

The runner treats the Figma submission HTTP response as the completion signal instead of waiting for `captureForDesign()` itself to resolve. This avoids false Playwright failures when Figma has already accepted the capture but the browser-side promise remains pending.

For a mobile reference, use:

```bash
FIGMA_CAPTURE_ID="<capture-id>" \
FIGMA_CAPTURE_PATH="/booking" \
FIGMA_CAPTURE_WIDTH=412 \
FIGMA_CAPTURE_HEIGHT=915 \
npm run figma:capture
```

## Initial capture order

Capture these first so the Figma audit follows the current development priorities:

1. Home, Services, Stylists and Booking.
2. Login, Register, Customer Account and Manage Account.
3. Dashboard and management navigation.
4. Employees, employee detail, staff profiles and staff accounts.
5. Roles/permissions and system administration.
6. Appointments, Calendar and Waitlist.
7. Services/products/inventory management.
8. Communications and campaign surfaces.
9. AI/ML pages and management intelligence surfaces.

Each Figma capture ID is single-use and must correspond to one page/view.

### Git Bash note

With Git Bash/MSYS, pass `FIGMA_CAPTURE_EXPECT_ROUTE` without a leading slash, for example `booking` rather than `/booking`. MSYS can rewrite Unix-looking environment values passed to Windows executables into filesystem paths such as `C:/Program Files/Git/booking`. The runner normalizes the route internally.
