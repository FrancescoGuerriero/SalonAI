# SalonAI Phase 8.4.1 — Davines Summer Retail Catalogue

Prepared from the Davines UK **Summer Favourites** collection requested on 12 August 2026.

## What this adds

- 43-item researched Davines Summer Favourites reference catalogue.
- 39 currently priced items eligible for SalonAI retail seeding.
- 4 reference-only items retained in the data file because the source showed them unavailable or without a retail price.
- New products are inserted with `stockQuantity=0`.
- Existing product stock, cost price and images are preserved.
- Existing SalonAI prices are preserved by default when the seed is re-run.
- Optional `--update-prices` deliberately refreshes existing retail prices.
- Product `collectionName` and `badge` fields.
- Brand and collection filtering in the public Shop.
- Davines Summer Favourites collection callout.
- Public product detail route: `/shop/:identifier`.
- Product cards link to product details.
- Product catalogue regression tests.

## Important retail rule

Reference prices are factual values observed from the requested Davines UK collection during research. They are not treated as permanent supplier pricing.

Before putting a product on sale, verify:

1. SalonAI is authorised to retail that product where required.
2. Physical stock is actually held.
3. The SalonAI selling price is correct.
4. Any product image used in SalonAI is licensed/authorised for that retail use.

For safety, the seed does **not** invent stock and does not copy Davines product imagery.

## Install

```powershell
Set-Location "C:\Users\Francesco\Desktop\CS_Projects\SalonAI_V2\SalonAI"

Expand-Archive `
  -Path "$env:USERPROFILE\Downloads\SalonAI_Phase_8_4_1_Davines_Summer_Retail.zip" `
  -DestinationPath "." `
  -Force
```

## Validate the catalogue without changing MongoDB

```powershell
Set-Location ".\backend"

npm run seed:davines-summer
```

Expected:

- Source products: 43
- Retail eligible: 39
- Reference only: 4
- no database changes

## Apply to the local/test database

Only after the dry run is green:

```powershell
npm run seed:davines-summer -- --apply
```

New items enter the product catalogue with zero stock.

If you intentionally want existing Davines products to take the researched reference price:

```powershell
npm run seed:davines-summer -- --apply --update-prices
```

Do not use `--update-prices` casually because a salon may intentionally use different retail pricing.

## Backend validation

```powershell
node ".\scripts\checkSource.js"

$backendTests = Get-ChildItem ".\src\test" -Filter "*.test.js" -Recurse |
    ForEach-Object { $_.FullName }

node --test $backendTests

Write-Host "BACKEND TESTS: $LASTEXITCODE"
```

## Frontend validation

```powershell
Set-Location "..\frontend"

node ".\node_modules\vite\bin\vite.js" build

Write-Host "FRONTEND BUILD: $LASTEXITCODE"
```

## Browser acceptance

After seeding and starting backend/frontend:

- `/shop`
- brand filter -> Davines
- collection filter -> Summer Favourites
- product search
- price sort
- `/shop/<product-slug>`
- zero-stock products cannot be added to cart
- after a management stock adjustment, in-stock products can be added to cart
- cart/checkout still works

## Production

This package is local development only. Do not seed or deploy production until Git synchronisation, local browser acceptance, Stripe/Twilio acceptance and release approval are complete.
