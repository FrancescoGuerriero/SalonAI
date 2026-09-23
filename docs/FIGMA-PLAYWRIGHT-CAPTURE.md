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
- `FIGMA_CAPTURE_DELAY_MS` — additional rendering wait; defaults to 1500 ms.
- `FIGMA_CAPTURE_WIDTH` — viewport width; defaults to 1440.
- `FIGMA_CAPTURE_HEIGHT` — viewport height; defaults to 1000.
- `FIGMA_CAPTURE_STRIP_CSP=false` — disable the capture utility's CSP-header stripping.\n- `FIGMA_CAPTURE_TEST_TIMEOUT_MS` — maximum Playwright wait for Figma processing; defaults to 300000 ms (5 minutes). Large production pages can take more than two minutes to finish server-side.

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
