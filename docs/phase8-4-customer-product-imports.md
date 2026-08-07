# Phase 8.4 — Customer and product imports

## Outcome

SalonAI now provides an administrator-only CSV import workspace at `/data-imports` for customer CRM profiles and retail products.

The workflow is deliberately split into validation and commit stages:

1. Download a header-only SalonAI template.
2. Upload a CSV file of no more than 500 data rows or 1 MB.
3. Choose whether matching records are skipped or updated.
4. Validate every row against the application rules and current database.
5. Review create, update, skip and error outcomes.
6. Explicitly authorise the import.
7. Download the final per-row result report.
8. Review the persistent import audit history.

No import is committed from the initial file-selection step.

## Customer safeguards

- First name, last name and at least one contact method are required.
- Email addresses and ISO dates are validated.
- Duplicate email and phone values are detected within the file and against MongoDB.
- If an email and phone resolve to different customers, the row is rejected.
- Imported records use `source: import`.
- Blank consent fields are treated as opted out.
- Email or SMS consent cannot be enabled without the matching contact method.
- Imports create CRM customer profiles only. They do not create login accounts or passwords.
- Raw customer rows are not stored in the import audit job or sent to the AI service.

Customer CSV headers:

```text
firstName,lastName,email,phone,title,preferredName,dateOfBirth,gender,addressLine1,addressLine2,city,county,postcode,country,preferredChannel,emailConsent,smsConsent,status,tags,notes
```

## Product safeguards

- Product name, SKU and retail price are required.
- SKU values are normalised to uppercase and matched against existing products.
- Price and cost values must be non-negative.
- Stock and reorder levels must be non-negative whole numbers.
- Image links must use HTTPS.
- Product updates set stock to the reviewed CSV quantity.
- Every change to an existing product's stock creates an inventory-adjustment record tied to the import job.

Product CSV headers:

```text
name,sku,brand,category,size,description,price,costPrice,stockQuantity,reorderLevel,imageUrl,featured,active
```

## API

All routes require an authenticated administrator:

- `POST /api/data-imports/preview`
- `POST /api/data-imports/commit`
- `GET /api/data-imports/history`

The backend repeats all validation during commit. A manipulated or stale browser preview cannot bypass the server rules.

## Audit behaviour

The `DataImportJob` record retains:

- entity type;
- duplicate policy;
- sanitised file name;
- SHA-256 content fingerprint;
- processing outcome and summary totals;
- up to 100 failure messages identified only by CSV row number;
- requesting administrator and timestamps.

Raw CSV data and full customer contact records are not retained in the audit job.

## Verification

- Backend syntax check: 503 JavaScript files passed.
- Backend application import: passed.
- Backend tests: 157 passed.
- Frontend tests: 10 passed.
- Frontend production build: passed.
- Palette contract: passed.
- AI service tests: 60 passed.

Production was not changed.
