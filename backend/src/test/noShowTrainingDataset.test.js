import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildNoShowTrainingRows,
  FEATURE_VERSION,
  PREDICTION_LEAD_HOURS,
} from "../features/aiPlatform/noShowTrainingDatasetService.js";

function appointment({
  id,
  customer = "customer-1",
  status,
  start,
  created,
  observed,
  reminderSentAt = null,
  rescheduleHistory = [],
}) {
  const terminal = {
    completed:
      "completedAt",
    no_show:
      "noShowAt",
    cancelled:
      "cancelledAt",
  }[status];

  return {
    _id: id,
    customer,
    stylist: "stylist-1",
    service: "service-1",
    startsAt:
      new Date(start),
    appointmentDate:
      new Date(start),
    appointmentTime:
      new Date(start)
        .toISOString()
        .slice(11, 16),
    duration: 60,
    totalPrice: 80,
    bookingSource:
      "website",
    status,
    reminderSentAt:
      reminderSentAt
        ? new Date(
            reminderSentAt
          )
        : null,
    rescheduleHistory,
    statusHistory: [],
    createdAt:
      new Date(created),
    updatedAt:
      new Date(observed),
    [terminal]:
      new Date(observed),
  };
}

test("no-show dataset uses 48-hour prediction snapshots with completed/no-show labels only", () => {
  const rows =
    buildNoShowTrainingRows(
      [
        appointment({
          id: "a1",
          status: "completed",
          start:
            "2026-01-10T12:00:00Z",
          created:
            "2026-01-01T12:00:00Z",
          observed:
            "2026-01-10T13:00:00Z",
        }),
        appointment({
          id: "a2",
          status: "no_show",
          start:
            "2026-02-10T18:00:00Z",
          created:
            "2026-02-01T12:00:00Z",
          observed:
            "2026-02-10T18:30:00Z",
          reminderSentAt:
            "2026-02-07T10:00:00Z",
        }),
        appointment({
          id: "a3",
          status: "cancelled",
          start:
            "2026-03-10T12:00:00Z",
          created:
            "2026-03-01T12:00:00Z",
          observed:
            "2026-03-08T09:00:00Z",
        }),
      ],
      {
        pseudonymKey:
          "12345678901234567890123456789012",
      }
    );

  assert.equal(
    PREDICTION_LEAD_HOURS,
    48
  );
  assert.equal(
    FEATURE_VERSION,
    "no-show-v1"
  );
  assert.equal(
    rows.length,
    2
  );
  assert.deepEqual(
    rows
      .map(
        (row) =>
          row.label
      )
      .sort(),
    [0, 1]
  );
  assert.equal(
    rows[1].features
      .reminder_sent_before_prediction,
    true
  );
  assert.equal(
    Object.hasOwn(
      rows[1].features,
      "payment_status"
    ),
    false
  );
});

test("history that was not resolved by prediction time is excluded from prior behaviour", () => {
  const rows =
    buildNoShowTrainingRows(
      [
        appointment({
          id: "previous",
          status: "no_show",
          start:
            "2026-04-01T12:00:00Z",
          created:
            "2026-03-20T12:00:00Z",
          observed:
            "2026-04-20T12:00:00Z",
        }),
        appointment({
          id: "target",
          status: "completed",
          start:
            "2026-04-15T12:00:00Z",
          created:
            "2026-04-01T12:00:00Z",
          observed:
            "2026-04-15T13:00:00Z",
        }),
      ],
      {
        pseudonymKey:
          "12345678901234567890123456789012",
      }
    );

  const target =
    rows.find(
      (row) =>
        row.label === 0
    );

  assert.equal(
    target.features
      .previous_no_shows,
    0
  );
  assert.equal(
    target.features
      .previous_bookings,
    0
  );
});

test("appointments booked inside the 48-hour decision window are excluded from v1 training", () => {
  const rows =
    buildNoShowTrainingRows(
      [
        appointment({
          id: "late-booking",
          status: "no_show",
          start:
            "2026-05-10T12:00:00Z",
          created:
            "2026-05-09T12:00:00Z",
          observed:
            "2026-05-10T13:00:00Z",
        }),
      ],
      {
        pseudonymKey:
          "12345678901234567890123456789012",
      }
    );

  assert.equal(
    rows.length,
    0
  );
});

test("training script benchmarks learned candidates against SalonAI rules", async () => {
  const source =
    await readFile(
      new URL(
        "../../../ai-service/train_no_show.py",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /salonai-no-show-risk-rules-v1/
  );
  assert.match(
    source,
    /predict_no_shows/
  );
  assert.match(
    source,
    /beats_rules_baseline/
  );
  assert.match(
    source,
    /average_precision_score/
  );
  assert.match(
    source,
    /brier_score_loss/
  );
});


test("post-prediction reschedules are excluded because final service/stylist/time would leak future state", () => {
  const rows =
    buildNoShowTrainingRows(
      [
        appointment({
          id:
            "rescheduled-after-snapshot",
          status:
            "completed",
          start:
            "2026-06-10T12:00:00Z",
          created:
            "2026-06-01T12:00:00Z",
          observed:
            "2026-06-10T13:00:00Z",
          rescheduleHistory: [
            {
              changedAt:
                new Date(
                  "2026-06-09T12:00:00Z"
                ),
            },
          ],
        }),
      ],
      {
        pseudonymKey:
          "12345678901234567890123456789012",
      }
    );

  assert.equal(
    rows.length,
    0
  );
});
