import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  buildCustomerAppointmentBackfillPlan,
  buildCustomerAppointmentOwnershipReadiness,
} from "../platform/tenancy/customerAppointmentOwnershipMigration.js";
import {
  calculateCustomerAppointmentBackfillFingerprint,
} from "../../scripts/planCustomerAppointmentTenantBackfill.js";

function oid() {
  return new mongoose.Types.ObjectId();
}

function fixture() {
  const businessId = oid();
  const locationId = oid();
  const customerOne = oid();
  const customerTwo = oid();
  const serviceOne = oid();
  const serviceTwo = oid();
  const stylistOne = oid();
  const stylistTwo = oid();

  const readiness =
    buildCustomerAppointmentOwnershipReadiness({
      businessId,
      locationId,
      businesses: [
        { _id: businessId },
      ],
      locations: [
        {
          _id: locationId,
          business: businessId,
          status: "active",
        },
      ],
      customers: [
        { _id: customerOne },
        { _id: customerTwo },
      ],
      services: [
        { _id: serviceOne, business: businessId },
        { _id: serviceTwo, business: businessId },
      ],
      stylists: [
        {
          _id: stylistOne,
          business: businessId,
          workingLocations: [locationId],
        },
        {
          _id: stylistTwo,
          business: businessId,
          workingLocations: [locationId],
        },
      ],
      appointments: [
        {
          _id: oid(),
          customer: customerOne,
          service: serviceOne,
          stylist: stylistOne,
        },
        {
          _id: oid(),
          customer: customerTwo,
          service: serviceTwo,
          stylist: stylistTwo,
        },
      ],
    });

  return {
    readiness,
    plan: buildCustomerAppointmentBackfillPlan(readiness),
  };
}

test("Customer/Appointment backfill fingerprint is independent of equivalent plan array ordering", () => {
  const { readiness, plan } = fixture();

  const original =
    calculateCustomerAppointmentBackfillFingerprint({
      readiness,
      plan,
    });

  const reorderedReadiness = {
    ...readiness,
    customerPlans: [
      ...readiness.customerPlans,
    ].reverse(),
    appointmentPlans: [
      ...readiness.appointmentPlans,
    ].reverse(),
  };

  const reorderedPlan = {
    ...plan,
    operations: [
      ...plan.operations,
    ].reverse(),
    rollback: [
      ...plan.rollback,
    ].reverse(),
  };

  const reordered =
    calculateCustomerAppointmentBackfillFingerprint({
      readiness: reorderedReadiness,
      plan: reorderedPlan,
    });

  assert.equal(
    original,
    reordered
  );
  assert.match(
    original,
    /^[a-f0-9]{64}$/
  );
});
