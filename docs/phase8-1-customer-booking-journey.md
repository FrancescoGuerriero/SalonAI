# Phase 8.1 customer booking journey

## Outcome

Phase 8.1 repairs the customer path from service selection to confirmed
appointment. It keeps the existing `/services`, `/stylists`, `/booking`, and
`/appointments` routes and adds one public, booking-safe availability route:

```text
GET /api/stylists/:id/availability?date=YYYY-MM-DD&service=<service-id>
```

The response contains working ranges and available slot times only. It does not
expose appointments, customer identities, notes, or time-off details.

## Live audit result

On 5 August 2026 the production API was healthy, but returned an empty service
catalogue and no active stylists. Customers therefore could not start a booking.
Production data must be configured after this release is deployed.

## Implemented controls

- Maps the stylist API fields (`firstName`, `lastName`, `profileImage`,
  `biography`, `specialties`, and `isActive`) to the customer interface.
- Shows only active stylists who match explicit service assignments.
- Calculates slots from stylist working hours, the selected service duration,
  existing appointments, approved time off, and the current time.
- Rechecks availability after a conflict and before appointment creation.
- Rejects past appointments, inactive services or stylists, and incompatible
  stylist/service combinations at the API boundary.
- Preserves the booking selection through the existing sign-in redirect.
- Gives customers a clear unavailable state when the production catalogue has
  not been configured.

## Catalogue configuration

The example catalogue is deliberately marked `productionReady: false`. Replace
all example services, prices, stylist details, assignments, and working hours,
then mark the reviewed file as production-ready.

Validate without changing MongoDB:

```bash
cd backend
npm run seed:booking -- \
  --file scripts/bookingCatalogue.example.json \
  --dry-run
```

Apply only a reviewed, production-ready file:

```bash
cd backend
npm run seed:booking -- --file /secure/path/bookingCatalogue.json
```

The seed is repeatable. Services are upserted by name and stylists by email.

## Verification

Run these gates before release:

```bash
cd backend
npm run validate

cd ../frontend
npm run validate

cd ../ai-service
.venv/bin/python -m pytest -q
```
