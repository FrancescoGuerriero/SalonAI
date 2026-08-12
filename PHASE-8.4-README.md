# SalonAI Phase 8.4 — About, Team Profiles and Profile Photography

This package is an additive development package prepared from the attached SalonAI working tree.

## Features

- Public `/about` page
- About link in navbar/footer
- Safe `GET /api/stylists/public` endpoint
- Five fictional demo employees
- Staff self-service `/staff/profile`
- Staff profile photo upload
- Customer profile photo upload
- Customer avatar in account/navigation
- Admin stylist photo upload
- Staff publish/unpublish profile
- Public stylist browsing without a preselected service
- Client/server image validation
- New profile tests
- Safe tracked-source archive script
- Detailed development audit and roadmap

## Install

From PowerShell:

```powershell
Set-Location "C:\Users\Francesco\Desktop\CS_Projects\SalonAI_V2\SalonAI"

Expand-Archive `
  -Path "$env:USERPROFILE\Downloads\SalonAI_Phase_8_4_Profiles_About_Development.zip" `
  -DestinationPath "." `
  -Force
```

## Optional: seed the five fictional demo staff

Use only in the development/test database unless you intentionally want placeholder staff:

```powershell
Set-Location ".\backend"

node ".\scripts\seedDemoStylists.js"
```

Expected catalogue:

- Maya Thompson
- Luca Romano
- Amara Okafor
- Sophie Bennett
- Daniel Kim

No passwords or staff User accounts are created.

## Validate backend

```powershell
Set-Location "C:\Users\Francesco\Desktop\CS_Projects\SalonAI_V2\SalonAI\backend"

node ".\scripts\checkSource.js"

$tests = Get-ChildItem ".\src\test" -Filter "*.test.js" -Recurse |
    ForEach-Object { $_.FullName }

node --test $tests

Write-Host "BACKEND TESTS: $LASTEXITCODE"
```

Audit-package target:

```text
Syntax check passed for 523 JavaScript files.
tests 185
pass 185
fail 0
BACKEND TESTS: 0
```

## Validate frontend

```powershell
Set-Location "C:\Users\Francesco\Desktop\CS_Projects\SalonAI_V2\SalonAI\frontend"

node --test `
  ".\src\utils\stylists.test.js" `
  ".\src\features\roadmap\roadmapFeatures.test.js" `
  ".\src\utils\palette.test.js" `
  ".\src\utils\csv.test.js" `
  ".\src\utils\profileMedia.test.js"

Write-Host "FRONTEND TESTS: $LASTEXITCODE"

node ".\node_modules\vite\bin\vite.js" build

Write-Host "FRONTEND BUILD: $LASTEXITCODE"
```

Target:

```text
tests 13
pass 13
fail 0
FRONTEND TESTS: 0
FRONTEND BUILD: 0
```

## Manual acceptance

Start backend and frontend and verify:

1. `/about`
2. `/stylists`
3. `/account`
4. `/account/manage`
5. `/staff/profile` as a stylist/manager/admin account
6. customer image upload
7. staff image upload
8. staff publish/unpublish
9. About team rendering
10. ordinary service -> stylist -> booking flow

## Git warning

The attached project's local Phase 8.1 branch is not currently present on GitHub and is based on a stale local `main`. Do not push directly to `main`.

Read:

`SALONAI-DEVELOPMENT-AUDIT-AND-ROADMAP.md`

before integrating the branch.

## Media architecture note

Images are resized client-side and stored as bounded data URLs for this MVP. Phase 8.6 should migrate profile/portfolio media to object storage + CDN before scale.

## Production

This package does not deploy anything and must not be used to bypass the existing immutable release/deployment process.
