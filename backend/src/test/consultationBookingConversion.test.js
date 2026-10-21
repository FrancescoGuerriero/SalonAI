import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConsultationAppointmentInput,
} from "../features/consultations/consultationBookingService.js";

function consultation(overrides = {}) {
  return {
    customer: "64f000000000000000000001",
    business: "64f000000000000000000002",
    location: "64f000000000000000000003",
    status: "booking_ready",
    deterministicAssessment: {
      bookingBlocked: false,
    },
    review: {
      decision: "approved",
      reviewedAt: new Date("2026-10-21T12:00:00Z"),
    },
    outcome: {
      recommendedService: "64f000000000000000000004",
      recommendedStylist: "64f000000000000000000005",
    },
    ...overrides,
  };
}

const effectiveService = {
  duration: 150,
  price: 120,
  priceOnConsultation: false,
};

test("consultation booking input uses approved canonical recommendations", () => {
  const input = buildConsultationAppointmentInput({
    consultation: consultation(),
    payload: {
      appointmentDate: "2026-10-30",
      appointmentTime: "11:30",
    },
    effectiveService,
  });

  assert.equal(input.customer, "64f000000000000000000001");
  assert.equal(input.service, "64f000000000000000000004");
  assert.equal(input.stylist, "64f000000000000000000005");
  assert.equal(input.duration, 150);
  assert.equal(input.totalPrice, 120);
  assert.equal(input.status, "confirmed");
});

test("consultation booking fails closed before human-approved booking readiness", () => {
  assert.throws(
    () =>
      buildConsultationAppointmentInput({
        consultation: consultation({ status: "awaiting_review" }),
        payload: {
          appointmentDate: "2026-10-30",
          appointmentTime: "11:30",
        },
        effectiveService,
      }),
    /must be approved for booking/
  );
});

test("price-on-consultation booking requires an explicit agreed price", () => {
  assert.throws(
    () =>
      buildConsultationAppointmentInput({
        consultation: consultation(),
        payload: {
          appointmentDate: "2026-10-30",
          appointmentTime: "11:30",
        },
        effectiveService: {
          ...effectiveService,
          priceOnConsultation: true,
        },
      }),
    /agreed non-negative price/
  );

  const input = buildConsultationAppointmentInput({
    consultation: consultation(),
    payload: {
      appointmentDate: "2026-10-30",
      appointmentTime: "11:30",
      totalPrice: 175,
    },
    effectiveService: {
      ...effectiveService,
      priceOnConsultation: true,
    },
  });

  assert.equal(input.totalPrice, 175);
});
