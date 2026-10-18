import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  buildCustomerAppointmentBackfillPlan,
  buildCustomerAppointmentOwnershipReadiness,
} from "../platform/tenancy/customerAppointmentOwnershipMigration.js";
import {
  calculateCustomerAppointmentBackfillFingerprint,
  sanitiseCustomerAppointmentBackfillPlan,
} from "../../scripts/planCustomerAppointmentTenantBackfill.js";

function oid() {
  return new mongoose.Types.ObjectId();
}

function safeReadiness() {
  const businessId =
    oid();
  const locationId =
    oid();
  const customerId =
    oid();
  const serviceId =
    oid();
  const stylistId =
    oid();
  const appointmentId =
    oid();

  return {
    businessId,
    locationId,
    customerId,
    serviceId,
    stylistId,
    appointmentId,
    readiness:
      buildCustomerAppointmentOwnershipReadiness({
        businessId,
        locationId,
        businesses: [
          {
            _id:
              businessId,
          },
        ],
        locations: [
          {
            _id:
              locationId,
            business:
              businessId,
            status:
              "active",
          },
        ],
        customers: [
          {
            _id:
              customerId,
          },
        ],
        services: [
          {
            _id:
              serviceId,
            business:
              businessId,
          },
        ],
        stylists: [
          {
            _id:
              stylistId,
            business:
              businessId,
            workingLocations: [
              locationId,
            ],
          },
        ],
        appointments: [
          {
            _id:
              appointmentId,
            customer:
              customerId,
            service:
              serviceId,
            stylist:
              stylistId,
          },
        ],
      }),
  };
}

test("Customer/Appointment backfill fingerprint is deterministic for the same reviewed snapshot", () => {
  const fixture =
    safeReadiness();

  const plan =
    buildCustomerAppointmentBackfillPlan(
      fixture.readiness
    );

  const left =
    calculateCustomerAppointmentBackfillFingerprint({
      readiness:
        fixture.readiness,
      plan,
    });

  const right =
    calculateCustomerAppointmentBackfillFingerprint({
      readiness:
        fixture.readiness,
      plan,
    });

  assert.equal(
    left,
    right
  );
  assert.match(
    left,
    /^[a-f0-9]{64}$/
  );
});

test("Customer/Appointment backfill fingerprint changes when a reviewed relationship changes", () => {
  const fixture =
    safeReadiness();

  const plan =
    buildCustomerAppointmentBackfillPlan(
      fixture.readiness
    );

  const original =
    calculateCustomerAppointmentBackfillFingerprint({
      readiness:
        fixture.readiness,
      plan,
    });

  const changedReadiness = {
    ...fixture.readiness,
    appointmentPlans: [
      {
        ...fixture.readiness
          .appointmentPlans[0],
        serviceId:
          String(
            oid()
          ),
      },
    ],
  };

  const changed =
    calculateCustomerAppointmentBackfillFingerprint({
      readiness:
        changedReadiness,
      plan,
    });

  assert.notEqual(
    original,
    changed
  );
});

test("sanitized Customer/Appointment backfill report contains counts and fingerprint but no ids or PII", () => {
  const fixture =
    safeReadiness();

  const plan =
    buildCustomerAppointmentBackfillPlan(
      fixture.readiness
    );

  const report =
    sanitiseCustomerAppointmentBackfillPlan({
      readiness:
        fixture.readiness,
      plan,
    });

  assert.equal(
    report.dryRun,
    true
  );
  assert.equal(
    report.writesPerformed,
    false
  );
  assert.equal(
    report.databaseWrites,
    false
  );
  assert.equal(
    report.piiIncluded,
    false
  );
  assert.equal(
    report.identifiersIncluded,
    false
  );
  assert.equal(
    report.executable,
    true
  );
  assert.equal(
    report.planned.operationTypes[
      "customer-update"
    ],
    1
  );
  assert.equal(
    report.planned.operationTypes[
      "appointment-update"
    ],
    1
  );
  assert.equal(
    report.planned.rollbackTypes[
      "customer-restore"
    ],
    1
  );
  assert.equal(
    report.planned.rollbackTypes[
      "appointment-restore"
    ],
    1
  );
  assert.match(
    report.planFingerprint,
    /^[a-f0-9]{64}$/
  );

  const text =
    JSON.stringify(
      report
    );

  for (
    const id of [
      fixture.businessId,
      fixture.locationId,
      fixture.customerId,
      fixture.serviceId,
      fixture.stylistId,
      fixture.appointmentId,
    ]
  ) {
    assert.doesNotMatch(
      text,
      new RegExp(
        String(id)
      )
    );
  }

  assert.doesNotMatch(
    text,
    /@/
  );
});

test("blocked readiness produces a non-executable zero-write plan", () => {
  const businessId =
    oid();
  const locationId =
    oid();

  const readiness =
    buildCustomerAppointmentOwnershipReadiness({
      businessId,
      locationId,
      businesses: [
        {
          _id:
            businessId,
        },
        {
          _id:
            oid(),
        },
      ],
      locations: [
        {
          _id:
            locationId,
          business:
            businessId,
          status:
            "active",
        },
      ],
      customers: [
        {
          _id:
            oid(),
        },
      ],
      services: [],
      stylists: [],
      appointments: [],
    });

  const plan =
    buildCustomerAppointmentBackfillPlan(
      readiness
    );

  const report =
    sanitiseCustomerAppointmentBackfillPlan({
      readiness,
      plan,
    });

  assert.equal(
    report.executable,
    false
  );
  assert.equal(
    report.blocked,
    true
  );
  assert.equal(
    plan.operations.length,
    0
  );
  assert.equal(
    report.databaseWrites,
    false
  );
});
