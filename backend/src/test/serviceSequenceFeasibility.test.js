import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSequenceAvailableSlots,
  buildServiceSequenceTimeline,
  normaliseServiceSequence,
} from "../features/bookingSequences/serviceSequenceFeasibility.js";

const DATE = "2030-06-15";
const NOW = new Date("2030-06-14T12:00:00.000Z");

const COLOUR_SEQUENCE = {
  primaryService: "colour-service",
  steps: [
    {
      order: 0,
      service: "colour-service",
      label: "Apply colour",
      durationMinutes: 30,
      providerRequired: true,
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
      service: "finish-service",
      label: "Finish",
      durationMinutes: 30,
      providerRequired: true,
      resourceRequirements: [
        {
          kind: "chair",
          resourceKey: "colour-chair",
          quantity: 1,
          exclusive: false,
        },
      ],
    },
  ],
};

test("normaliseServiceSequence exposes deterministic total duration", () => {
  const sequence = normaliseServiceSequence(COLOUR_SEQUENCE);
  assert.equal(sequence.totalDurationMinutes, 90);
  assert.equal(sequence.steps.length, 2);
});

test("buildServiceSequenceTimeline releases provider during processing gap", () => {
  const timeline = buildServiceSequenceTimeline(COLOUR_SEQUENCE, 9 * 60);

  assert.deepEqual(
    timeline.segments.map((segment) => ({
      type: segment.type,
      start: segment.startMinutes,
      end: segment.endMinutes,
      providerRequired: segment.providerRequired,
    })),
    [
      {
        type: "service",
        start: 540,
        end: 570,
        providerRequired: true,
      },
      {
        type: "processing_gap",
        start: 570,
        end: 600,
        providerRequired: false,
      },
      {
        type: "service",
        start: 600,
        end: 630,
        providerRequired: true,
      },
    ]
  );
});

test("provider work during a processing gap does not block the sequence", () => {
  const slots = buildSequenceAvailableSlots({
    date: DATE,
    ranges: [{ start: "09:00", end: "11:00" }],
    sequence: COLOUR_SEQUENCE,
    providerAppointments: [
      {
        startsAt: new Date("2030-06-15T08:30:00.000Z"),
        endsAt: new Date("2030-06-15T09:00:00.000Z"),
        status: "confirmed",
      },
    ],
    resources: {
      "chair:colour-chair": {
        capacity: 2,
        busy: [],
      },
    },
    interval: 30,
    now: NOW,
  });

  assert.deepEqual(slots, ["09:00", "10:00"]);
});

test("resource capacity blocks otherwise feasible sequence starts", () => {
  const slots = buildSequenceAvailableSlots({
    date: DATE,
    ranges: [{ start: "09:00", end: "11:00" }],
    sequence: COLOUR_SEQUENCE,
    resources: {
      "chair:colour-chair": {
        capacity: 1,
        busy: [
          {
            startsAt: new Date("2030-06-15T08:00:00.000Z"),
            endsAt: new Date("2030-06-15T09:30:00.000Z"),
            quantity: 1,
          },
        ],
      },
    },
    interval: 30,
    now: NOW,
  });

  assert.deepEqual(slots, []);
});

test("missing required resources fail closed", () => {
  const slots = buildSequenceAvailableSlots({
    date: DATE,
    ranges: [{ start: "09:00", end: "11:00" }],
    sequence: COLOUR_SEQUENCE,
    resources: {},
    interval: 30,
    now: NOW,
  });

  assert.deepEqual(slots, []);
});

test("invalid duplicate step order is rejected", () => {
  assert.throws(
    () =>
      normaliseServiceSequence({
        steps: [
          { order: 0, durationMinutes: 30 },
          { order: 0, durationMinutes: 30 },
        ],
      }),
    /order values must be unique/
  );
});
