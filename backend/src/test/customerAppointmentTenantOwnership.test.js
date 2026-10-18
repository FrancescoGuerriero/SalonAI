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

function baseOwnershipFixture(overrides = {}) {
  const businessId = overrides.businessId || oid();
  const locationId = overrides.locationId || oid();
  const customerId = overrides.customerId || oid();
  const serviceId = overrides.serviceId || oid();
  const stylistId = overrides.stylistId || oid();

  return {
    businessId,
    locationId,
    businesses: [{ _id: businessId }],
    locations: [
      {
        _id: locationId,
        business: businessId,
        status: "active",
      },
    ],
    customers: [{ _id: customerId }],
    services: [{ _id: serviceId, business: businessId }],
    stylists: [
      {
        _id: stylistId,
        business: businessId,
        workingLocations: [locationId],
      },
    ],
    appointments: [
      {
        _id: oid(),
        customer: customerId,
        service: serviceId,
        stylist: stylistId,
      },
    ],
    ...overrides,
  };
}

test("Customer and Appointment ownership fields remain additive during preparation", () => {
  assert.equal(Customer.schema.path("business").options.required, undefined);
  assert.equal(Appointment.schema.path("business").options.required, undefined);
  assert.equal(Appointment.schema.path("location").options.required, undefined);
});

test("existing uniqueness contracts are preserved while Customer userAccount uses the partial linked-account index", () => {
  const userAccountIndex = Customer.schema
    .indexes()
    .find(
      ([definition, options]) =>
        definition.userAccount === 1 &&
        options.name === "userAccount_unique_linked"
    );

  assert.ok(userAccountIndex);
  assert.equal(userAccountIndex[1].unique, true);
  assert.deepEqual(userAccountIndex[1].partialFilterExpression, {
    userAccount: { $type: "objectId" },
  });

  assert.equal(Customer.schema.path("email").options.unique, true);
  assert.equal(Customer.schema.path("phone").options.unique, true);
  assert.equal(Appointment.schema.path("invoiceNumber").options.unique, true);
  assert.equal(
    Appointment.schema.path("externalBookingReference").options.unique,
    true
  );
});

test("legacy Customer/Appointment attribution requires one Business and one active Location", () => {
  const businessId = oid();
  const locationId = oid();

  const safe = buildCustomerAppointmentMigrationScope({
    businessId,
    locationId,
    businesses: [{ _id: businessId }],
    locations: [
      {
        _id: locationId,
        business: businessId,
        status: "active",
      },
    ],
  });

  assert.equal(safe.safeForGlobalCustomerBackfill, true);
  assert.equal(safe.safeForGlobalAppointmentBackfill, true);

  const multiLocation = buildCustomerAppointmentMigrationScope({
    businessId,
    locationId,
    businesses: [{ _id: businessId }],
    locations: [
      {
        _id: locationId,
        business: businessId,
        status: "active",
      },
      {
        _id: oid(),
        business: businessId,
        status: "active",
      },
    ],
  });

  assert.equal(multiLocation.safeForGlobalCustomerBackfill, true);
  assert.equal(multiLocation.safeForGlobalAppointmentBackfill, false);
  assert.ok(
    multiLocation.appointmentBlockers.includes(
      "global-appointment-scope-not-single-location"
    )
  );
});

test("readiness assigns unowned Customer and Appointment when all references are same-Business", () => {
  const readiness = buildCustomerAppointmentOwnershipReadiness(
    baseOwnershipFixture()
  );

  assert.equal(readiness.safeForBackfill, true);
  assert.equal(readiness.summary.customerBusinessAssignments, 1);
  assert.equal(readiness.summary.appointmentBusinessAssignments, 1);
  assert.equal(readiness.summary.appointmentLocationAssignments, 1);

  const plan = buildCustomerAppointmentBackfillPlan(readiness);
  assert.equal(plan.writesPerformed, false);
  assert.equal(plan.executable, true);
  assert.deepEqual(
    plan.operations.map((operation) => operation.type),
    ["customer-update", "appointment-update"]
  );
});

test("readiness blocks Appointment when Service is missing or belongs to another Business", () => {
  const fixture = baseOwnershipFixture();
  const foreignServiceId = oid();
  const readiness = buildCustomerAppointmentOwnershipReadiness({
    ...fixture,
    services: [{ _id: foreignServiceId, business: oid() }],
    appointments: [
      {
        ...fixture.appointments[0],
        service: foreignServiceId,
      },
    ],
  });

  assert.equal(readiness.safeForBackfill, false);
  assert.ok(
    readiness.blockers.some((item) =>
      [
        "appointment-service-missing",
        "appointment-service-business-conflict",
      ].includes(item.blocker)
    )
  );
});

test("readiness blocks Customer already owned by another Business", () => {
  const fixture = baseOwnershipFixture({ appointments: [], services: [], stylists: [] });
  const readiness = buildCustomerAppointmentOwnershipReadiness({
    ...fixture,
    customers: [{ _id: oid(), business: oid() }],
  });

  assert.equal(readiness.safeForBackfill, false);
  assert.ok(
    readiness.blockers.some(
      (item) => item.blocker === "customer-owned-by-other-business"
    )
  );
});

test("second Business blocks global legacy Customer/Appointment attribution", () => {
  const fixture = baseOwnershipFixture({ appointments: [], services: [], stylists: [] });
  const readiness = buildCustomerAppointmentOwnershipReadiness({
    ...fixture,
    businesses: [...fixture.businesses, { _id: oid() }],
  });

  assert.equal(readiness.safeForBackfill, false);
  assert.ok(
    readiness.blockers.some(
      (item) => item.blocker === "global-customer-scope-not-proven"
    )
  );
});

test("readiness blocks Appointment when Stylist is not assigned to the target Location", () => {
  const fixture = baseOwnershipFixture();
  const readiness = buildCustomerAppointmentOwnershipReadiness({
    ...fixture,
    stylists: [
      {
        ...fixture.stylists[0],
        workingLocations: [oid()],
      },
    ],
  });

  assert.equal(readiness.safeForBackfill, false);
  assert.ok(
    readiness.blockers.some(
      (item) => item.blocker === "appointment-stylist-location-unproven"
    )
  );
});
