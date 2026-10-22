import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSequenceReservationPlan,
} from "../features/bookingSequences/sequenceReservationPlan.js";

const SEQUENCE = {
  _id: "sequence-colour",
  primaryService: "service-colour",
  steps: [
    {
      order: 0,
      service: "service-colour",
      durationMinutes: 45,
      processingGapAfterMinutes: 30,
      holdResourcesDuringGap: true,
      resourceRequirements: [
        {
          kind: "chair",
          resourceKey: "colour-chair",
          quantity: 1,
          exclusive: false,
        },
      ],
    },
    {
      order: 1,
      service: "service-finish",
      durationMinutes: 30,
      resourceRequirements: [
        {
          kind: "room",
          resourceKey: "finish-room",
          quantity: 1,
          exclusive: true,
        },
      ],
    },
  ],
};

const RESOURCES = [
  {
    _id: "resource-chair",
    kind: "chair",
    key: "colour-chair",
    capacity: 2,
    active: true,
  },
  {
    _id: "resource-room",
    kind: "room",
    key: "finish-room",
    capacity: 1,
    active: true,
  },
];

test("sequence reservation plan preserves processing gaps and resource holds", () => {
  const plan = buildSequenceReservationPlan({
    sequence: SEQUENCE,
    date: "2030-06-15",
    startTime: "09:00",
    resources: RESOURCES,
  });

  assert.equal(plan.totalDurationMinutes, 105);
  assert.equal(plan.startTime, "09:00");
  assert.equal(plan.endTime, "10:45");
  assert.equal(plan.reservations.length, 3);
  assert.deepEqual(
    plan.reservations.map((item) => [item.kind, item.segmentType, item.quantity]),
    [
      ["chair", "service", 1],
      ["chair", "processing_gap", 1],
      ["room", "service", 1],
    ]
  );
  assert.equal(plan.startsAt.toISOString(), "2030-06-15T08:00:00.000Z");
  assert.equal(plan.endsAt.toISOString(), "2030-06-15T09:45:00.000Z");
});

test("sequence reservation plan fails when a required location resource is absent", () => {
  assert.throws(
    () =>
      buildSequenceReservationPlan({
        sequence: SEQUENCE,
        date: "2030-06-15",
        startTime: "09:00",
        resources: RESOURCES.slice(0, 1),
      }),
    { code: "BOOKING_RESOURCE_NOT_FOUND" }
  );
});
