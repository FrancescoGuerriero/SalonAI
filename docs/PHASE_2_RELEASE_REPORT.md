# SalonAI Phase 2 Release Report

**Release:** Phase 2 — E-commerce  
**Completed:** 25 July 2026

## Delivered

- Public product catalogue with search, filtering and sorting
- Persistent React shopping cart
- Authenticated collection/delivery checkout
- Stripe-hosted Checkout integration
- Local console payment simulation
- Stripe webhook signature verification
- Customer order history and pending-order cancellation
- Product catalogue administration
- Inventory summary, reorder thresholds and low-stock reporting
- Audited stock adjustments
- Management order processing
- Demonstration product seeder
- Corrected Windows verification and development scripts

## Validation

| Check | Result |
|---|---:|
| Backend JavaScript files syntax-checked | 208 |
| Backend tests | 22 passed, 0 failed |
| Frontend JavaScript/JSX files parsed | 149 |
| Combined modules/import graph | 359 |
| Parse errors | 0 |
| Unresolved local imports | 0 |
| Missing imported exports | 0 |
| Backend endpoints mapped | 265 |
| Frontend HTTP calls mapped | 121 |
| Frontend calls without backend routes | 0 |
| Exact duplicate files | 0 |
| Duplicate Mongoose registrations | 0 |
| Merge-conflict markers | 0 |
| Package-lock dependency-tree errors | 0 |

The standalone files reported outside the application-entry graph are expected scripts, tests and `vite.config.js`.

## Frontend build note

The source, JSX, imports and API contracts passed validation. A complete Vite build cannot run in the Linux validation container because the retained dependency cache lacks Vite 8's Linux Rolldown optional native binary. The distributed ZIP excludes `node_modules`; `npm ci` on Windows installs the correct Windows native package before `npm run build`.

## First run

```powershell
cd "C:\Users\Francesco\Desktop\CS_Projects\SalonAI_Phase2\SalonAI"
Copy-Item backend\.env.example backend\.env -Force
Copy-Item frontend\.env.example frontend\.env -Force
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\scripts\verify-project.ps1
```

Set `MONGODB_URI` and a strong `JWT_SECRET` in `backend/.env`, then seed products:

```powershell
npm --prefix backend run seed:commerce
```

Start both development servers:

```powershell
.\scripts\start-dev.ps1
```
