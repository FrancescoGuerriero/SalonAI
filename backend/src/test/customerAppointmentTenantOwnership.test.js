import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import Customer from "../models/customer.js";
import Appointment from "../models/Appointment.js";
import {
  buildCustomerAppointmentBackfillPlan,
  buildCustomerAppointmentMigrationScope,
  buildCustomerAppointmentOwnershipReadiness,
} from "../platform/tenancy/customerAppointmentOwnershipMigration.js";

function oid() {
  return new mongoose.Types.ObjectId();
}

test("Customer and Appointment ownership fields remain additive during preparation", () => {
  assert.equal(
    Customer.schema.path(
      "business"
    ).options.required,
    undefined
  );

  assert.equal(
    Appointment.schema.path(
      "business"
    ).options.required,
    undefined
  );

  assert.equal(
    Appointment.schema.path(
      "location"
    ).options.required,
    undefined
  );
});

test("legacy global uniqueness is preserved during Customer/Appointment ownership preparation", () => {
  assert.equal(
    Customer.schema.path(
      "userAccount"
    ).options.unique,
    true
  );
  assert.equal(
    Customer.schema.path(
      "email"
    ).options.unique,
    true
  );
  assert.equal(
    Customer.schema.path(
      "phone"
    ).options.unique,
    true
  );
  assert.equal(
    Appointment.schema.path(
      "invoiceNumber"
    ).options.unique,
    true
  );
  assert.equal(
    Appointment.schema.path(
      "externalBookingReference"
    ).options.unique,
    true
  );
});

test("legacy Customer/Appointment backfill requires one Business and one Location", () => {
  const businessId =
    oid();
  const locationId =
    oid();

  const safe =
    buildCustomerAppointmentMigrationScope({
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
    });

  assert.equal(
    safe.safeForGlobalCustomerBackfill,
    true
  );
  assert.equal(
    safe.safeForGlobalAppointmentBackfill,
    true
  );

  const multiLocation =
    buildCustomerAppointmentMigrationScope({
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
        {
          _id:
            oid(),
          business:
            businessId,
          status:
            "active",
        },
      ],
    });

  assert.equal(
    multiLocation.safeForGlobalCustomerBackfill,
    true
  );
  assert.equal(
    multiLocation.safeForGlobalAppointmentBackfill,
    false
  );
  assert.ok(
    multiLocation.appointmentBlockers.includes(
      "global-appointment-scope-not-single-location"
    )
  );
});

test("readiness assigns unowned Customer and Appointment when references are same-Business", () => {
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

  const readiness =
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
    });

  assert.equal(
    readiness.safeForBackfill,
    true
  );
  assert.equal(
    readiness.summary.customerBusinessAssignments,
    1
  );
  assert.equal(
    readiness.summary.appointmentBusinessAssignments,
    1
  );
  assert.equal(
    readiness.summary.appointmentLocationAssignments,
    1
  );

  const plan =
    buildCustomerAppointmentBackfillPlan(
      readiness
    );

  assert.equal(
    plan.writesPerformed,
    false
  );
  assert.equal(
    plan.executable,
    true
  );
  assert.deepEqual(
    plan.operations.map(
      (operation) =>
        operation.type
    ),
    [
      "customer-update",
      "appointment-update",
    ]
  );
});

test("readiness blocks Appointment when Service belongs to another Business", () => {
  const businessId =
    oid();
  const locationId =
    oid();
  const customerId =
    oid();
  const stylistId =
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
            oid(),
          business:
            oid(),
        },
      ],
      stylists: [
        {
          _id:
            stylistId,
          business:
            businessId,
        },
      ],
      appointments: [
        {
          _id:
            oid(),
          customer:
            customerId,
          service:
            oid(),
          stylist:
            stylistId,
        },
      ],
    });

  assert.equal(
    readiness.safeForBackfill,
    false
  );
  assert.ok(
    readiness.blockers.some(
      (item) =>
        [
          "appointment-service-missing",
          "appointment-service-business-conflict",
        ].includes(
          item.blocker
        )
    )
  );
});

test("readiness blocks Customer already owned by another Business", () => {
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
          business:
            oid(),
        },
      ],
      appointments: [],
      services: [],
      stylists: [],
    });

  assert.equal(
    readiness.safeForBackfill,
    false
  );
  assert.ok(
    readiness.blockers.some(
      (item) =>
        item.blocker ===
        "customer-owned-by-other-business"
    )
  );
});

test("second Business blocks global legacy Customer/Appointment attribution", () => {
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
      appointments: [],
      services: [],
      stylists: [],
    });

  assert.equal(
    readiness.safeForBackfill,
    false
  );
  assert.ok(
    readiness.blockers.some(
      (item) =>
        item.blocker ===
        "global-customer-scope-not-proven"
    )
  );
});
