import crypto from "node:crypto";

import Appointment from "../../models/Appointment.js";
import AiFeatureSnapshot from "./AiFeatureSnapshot.js";
import AiTrainingDataset from "./AiTrainingDataset.js";

const TASK =
  "no_show_prediction";
const FEATURE_VERSION =
  "no-show-v1";
const DATASET_NAME =
  "salonai-no-show";
const PREDICTION_LEAD_HOURS =
  48;
const DATASET_SPLITS = [
  "train",
  "validation",
  "test",
];

const LABEL_STATUSES =
  new Set([
    "completed",
    "no_show",
  ]);

const HISTORY_STATUSES =
  new Set([
    "completed",
    "no_show",
    "cancelled",
  ]);

function asDate(value) {
  const date =
    value
      ? new Date(value)
      : null;

  return (
    date &&
    !Number.isNaN(
      date.getTime()
    )
  )
    ? date
    : null;
}

function appointmentStart(
  appointment
) {
  const direct =
    asDate(
      appointment.startsAt
    );

  if (direct) {
    return direct;
  }

  const anchor =
    asDate(
      appointment.appointmentDate
    );

  if (!anchor) {
    return null;
  }

  const match =
    String(
      appointment.appointmentTime ||
        ""
    ).match(
      /^(\d{2}):(\d{2})$/
    );

  if (!match) {
    return null;
  }

  anchor.setHours(
    Number(match[1]),
    Number(match[2]),
    0,
    0
  );

  return anchor;
}

function terminalObservedAt(
  appointment
) {
  const direct = {
    completed:
      appointment.completedAt,
    no_show:
      appointment.noShowAt,
    cancelled:
      appointment.cancelledAt,
  }[appointment.status];

  const directDate =
    asDate(direct);

  if (directDate) {
    return directDate;
  }

  const history =
    Array.isArray(
      appointment.statusHistory
    )
      ? appointment.statusHistory
      : [];

  const matches =
    history
      .filter(
        (entry) =>
          entry.newStatus ===
          appointment.status
      )
      .map(
        (entry) =>
          asDate(
            entry.changedAt
          )
      )
      .filter(Boolean)
      .sort(
        (a, b) =>
          a.getTime() -
          b.getTime()
      );

  return (
    matches.at(-1) ||
    asDate(
      appointment.updatedAt
    )
  );
}

function pseudonym(
  namespace,
  value,
  key
) {
  return crypto
    .createHmac(
      "sha256",
      key
    )
    .update(
      namespace +
        ":" +
        String(value || "")
    )
    .digest("hex")
    .slice(0, 32);
}

function daysBetween(
  later,
  earlier
) {
  if (
    !later ||
    !earlier
  ) {
    return null;
  }

  return (
    later.getTime() -
    earlier.getTime()
  ) / 86_400_000;
}

function historyBefore(
  appointments,
  target,
  asOf
) {
  const customerId =
    String(
      target.customer || ""
    );

  return appointments.filter(
    (item) => {
      if (
        String(
          item._id
        ) ===
        String(
          target._id
        )
      ) {
        return false;
      }

      if (
        String(
          item.customer || ""
        ) !== customerId ||
        !HISTORY_STATUSES.has(
          item.status
        )
      ) {
        return false;
      }

      const observed =
        terminalObservedAt(
          item
        );

      return (
        observed &&
        observed <= asOf
      );
    }
  );
}

function reschedulesBefore(
  appointment,
  asOf
) {
  return (
    Array.isArray(
      appointment.rescheduleHistory
    )
      ? appointment
          .rescheduleHistory
      : []
  ).filter(
    (entry) => {
      const changed =
        asDate(
          entry.changedAt
        );

      return (
        changed &&
        changed <= asOf
      );
    }
  ).length;
}

function buildFeatureRow({
  appointment,
  appointments,
  pseudonymKey,
}) {
  if (
    !LABEL_STATUSES.has(
      appointment.status
    )
  ) {
    return null;
  }

  const start =
    appointmentStart(
      appointment
    );
  const createdAt =
    asDate(
      appointment.createdAt
    );

  if (
    !start ||
    !createdAt
  ) {
    return null;
  }

  const asOf =
    new Date(
      start.getTime() -
        PREDICTION_LEAD_HOURS *
          3_600_000
    );

  if (
    createdAt > asOf
  ) {
    return null;
  }

  const hasPostPredictionReschedule =
    (
      Array.isArray(
        appointment.rescheduleHistory
      )
        ? appointment.rescheduleHistory
        : []
    ).some(
      (entry) => {
        const changed =
          asDate(
            entry.changedAt
          );

        return (
          changed &&
          changed > asOf
        );
      }
    );

  if (
    hasPostPredictionReschedule
  ) {
    return null;
  }

  const history =
    historyBefore(
      appointments,
      appointment,
      asOf
    );

  const completed =
    history.filter(
      (item) =>
        item.status ===
        "completed"
    );
  const noShows =
    history.filter(
      (item) =>
        item.status ===
        "no_show"
    );
  const cancelled =
    history.filter(
      (item) =>
        item.status ===
        "cancelled"
    );

  const lastCompleted =
    completed
      .map((item) => ({
        item,
        observed:
          terminalObservedAt(
            item
          ),
      }))
      .filter(
        (entry) =>
          entry.observed
      )
      .sort(
        (a, b) =>
          b.observed.getTime() -
          a.observed.getTime()
      )[0] || null;

  const previousBookings =
    completed.length +
    noShows.length +
    cancelled.length;

  const reminderSent =
    Boolean(
      appointment.reminderSentAt &&
      asDate(
        appointment.reminderSentAt
      ) <= asOf
    );

  const hour =
    start.getHours();
  const weekday =
    start.getDay();

  const features = {
    previous_bookings:
      previousBookings,
    previous_completed:
      completed.length,
    previous_no_shows:
      noShows.length,
    previous_no_show_rate:
      previousBookings
        ? noShows.length /
          previousBookings
        : 0,
    previous_cancellations:
      cancelled.length,
    previous_cancellation_rate:
      previousBookings
        ? cancelled.length /
          previousBookings
        : 0,
    days_since_last_completed:
      lastCompleted
        ? daysBetween(
            asOf,
            lastCompleted
              .observed
          )
        : null,
    is_new_customer:
      previousBookings === 0,
    booking_lead_time_days:
      Math.max(
        0,
        daysBetween(
          start,
          createdAt
        ) || 0
      ),
    reschedules_before_prediction:
      reschedulesBefore(
        appointment,
        asOf
      ),
    reminder_sent_before_prediction:
      reminderSent,
    appointment_weekday:
      weekday,
    appointment_hour:
      hour,
    is_weekend:
      weekday === 0 ||
      weekday === 6,
    is_evening:
      hour >= 17,
    duration_minutes:
      Math.max(
        1,
        Number(
          appointment.duration
        ) || 60
      ),
    appointment_value:
      Math.max(
        0,
        Number(
          appointment.totalPrice
        ) || 0
      ),
    booking_source:
      String(
        appointment.bookingSource ||
          "unknown"
      ),
    service_key:
      pseudonym(
        "service",
        appointment.service,
        pseudonymKey
      ),
    stylist_key:
      pseudonym(
        "stylist",
        appointment.stylist,
        pseudonymKey
      ),
  };

  return {
    task: TASK,
    entityType:
      "appointment",
    entityKey:
      pseudonym(
        "appointment",
        appointment._id,
        pseudonymKey
      ),
    asOf,
    featureVersion:
      FEATURE_VERSION,
    features,
    label:
      appointment.status ===
      "no_show"
        ? 1
        : 0,
    labelObservedAt:
      terminalObservedAt(
        appointment
      ),
    sourceRefs: [
      {
        collection:
          Appointment.collection
            .name,
        documentId:
          String(
            appointment._id
          ),
      },
    ],
    privacy: {
      containsDirectIdentifiers:
        false,
      pseudonymised: true,
      purpose:
        "model_training_and_evaluation",
    },
    metadata: {
      predictionLeadHours:
        PREDICTION_LEAD_HOURS,
      labelPolicy:
        "no_show=1,completed=0,cancelled_excluded",
      excludedLeakageFields: [
        "current_status",
        "payment_status_without_history",
        "amount_paid_without_history",
        "post_prediction_reschedules",
        "post_prediction_service_or_stylist_changes_via_reschedule",
        "post_prediction_reminders",
      ],
    },
    _sortDate: start,
  };
}

function assignTemporalSplits(
  rows
) {
  const ordered =
    [...rows].sort(
      (a, b) =>
        a._sortDate.getTime() -
        b._sortDate.getTime()
    );

  const trainEnd =
    Math.max(
      1,
      Math.floor(
        ordered.length *
          0.70
      )
    );
  const validationEnd =
    Math.max(
      trainEnd + 1,
      Math.floor(
        ordered.length *
          0.85
      )
    );

  return ordered.map(
    (row, index) => ({
      ...row,
      split:
        index < trainEnd
          ? "train"
          : index <
              validationEnd
            ? "validation"
            : "test",
    })
  );
}

function schemaHash(rows) {
  const names =
    rows.length
      ? Object.keys(
          rows[0].features
        ).sort()
      : [];

  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        names
      )
    )
    .digest("hex");
}

function labelDistribution(
  rows
) {
  return rows.reduce(
    (summary, row) => {
      const key =
        String(row.label);

      summary[key] =
        (summary[key] || 0) +
        1;

      return summary;
    },
    {}
  );
}

function splitLabelDistribution(
  rows
) {
  const distribution =
    Object.fromEntries(
      DATASET_SPLITS.map(
        (split) => [
          split,
          {
            "0": 0,
            "1": 0,
          },
        ]
      )
    );

  for (const row of rows) {
    if (
      !Object.hasOwn(
        distribution,
        row.split
      )
    ) {
      continue;
    }

    const label =
      String(row.label);

    if (
      label === "0" ||
      label === "1"
    ) {
      distribution[
        row.split
      ][label] += 1;
    }
  }

  return distribution;
}

export function evaluateNoShowDatasetReadiness(
  rows
) {
  const safeRows =
    Array.isArray(rows)
      ? rows
      : [];
  const blockers = [];
  const warnings = [];
  const splitLabels =
    splitLabelDistribution(
      safeRows
    );

  if (
    safeRows.length < 30
  ) {
    blockers.push(
      "At least 30 eligible historical appointments are required."
    );
  }

  for (
    const split of
    DATASET_SPLITS
  ) {
    const labels =
      splitLabels[split];
    const count =
      labels["0"] +
      labels["1"];

    if (count === 0) {
      blockers.push(
        `Temporal split '${split}' is empty.`
      );
      continue;
    }

    if (
      labels["0"] === 0 ||
      labels["1"] === 0
    ) {
      blockers.push(
        `Temporal split '${split}' must contain both completed (0) and no-show (1) labels.`
      );
    }
  }

  if (
    safeRows.length > 0 &&
    safeRows.length < 100
  ) {
    warnings.push(
      "Small dataset: treat model metrics as exploratory until more resolved appointments are available."
    );
  }

  const totals =
    labelDistribution(
      safeRows
    );
  const positiveRate =
    safeRows.length
      ? (
          Number(
            totals["1"] ||
              0
          ) /
          safeRows.length
        )
      : 0;

  if (
    safeRows.length >= 30 &&
    (
      positiveRate <
        0.05 ||
      positiveRate >
        0.95
    )
  ) {
    warnings.push(
      "Severe class imbalance: review no-show prevalence and evaluation uncertainty before interpreting model metrics."
    );
  }

  return {
    readyToFreeze:
      blockers.length === 0,
    blockers,
    warnings,
    splitLabelDistribution:
      splitLabels,
  };
}

export function buildNoShowTrainingRows(
  appointments,
  {
    pseudonymKey,
  } = {}
) {
  if (!pseudonymKey) {
    throw new Error(
      "A pseudonym key is required to build AI training features."
    );
  }

  const rows =
    appointments
      .map(
        (appointment) =>
          buildFeatureRow({
            appointment,
            appointments,
            pseudonymKey,
          })
      )
      .filter(Boolean);

  return assignTemporalSplits(
    rows
  );
}

export async function materialiseNoShowTrainingDataset({
  datasetVersion,
  pseudonymKey,
  apply = false,
} = {}) {
  if (!datasetVersion) {
    throw new Error(
      "datasetVersion is required."
    );
  }

  const appointments =
    await Appointment.find({
      status: {
        $in: [
          "completed",
          "no_show",
          "cancelled",
        ],
      },
    })
      .select(
        "_id customer stylist service startsAt appointmentDate appointmentTime duration totalPrice bookingSource status reminderSentAt rescheduleHistory statusHistory completedAt noShowAt cancelledAt createdAt updatedAt"
      )
      .sort({
        startsAt: 1,
        appointmentDate: 1,
        _id: 1,
      })
      .lean();

  const rows =
    buildNoShowTrainingRows(
      appointments,
      {
        pseudonymKey,
      }
    );

  const cleanRows =
    rows.map(
      ({
        _sortDate,
        ...row
      }) => ({
        ...row,
        datasetVersion,
      })
    );

  const dates =
    rows.map(
      (row) =>
        row._sortDate
    );

  const readiness =
    evaluateNoShowDatasetReadiness(
      rows
    );

  const summary = {
    task: TASK,
    datasetName:
      DATASET_NAME,
    datasetVersion,
    featureVersion:
      FEATURE_VERSION,
    predictionLeadHours:
      PREDICTION_LEAD_HOURS,
    sourceAppointmentCount:
      appointments.length,
    eligibleSnapshotCount:
      rows.length,
    labelDistribution:
      labelDistribution(rows),
    splitDistribution:
      rows.reduce(
        (counts, row) => {
          counts[row.split] =
            (counts[
              row.split
            ] || 0) + 1;
          return counts;
        },
        {}
      ),
    splitLabelDistribution:
      readiness
        .splitLabelDistribution,
    readiness: {
      readyToFreeze:
        readiness
          .readyToFreeze,
      blockers:
        readiness.blockers,
      warnings:
        readiness.warnings,
    },
    schemaHash:
      schemaHash(rows),
    observationStart:
      dates.at(0) || null,
    observationEnd:
      dates.at(-1) || null,
  };

  if (!apply) {
    return {
      applied: false,
      summary,
      rows: cleanRows,
    };
  }

  if (
    !readiness
      .readyToFreeze
  ) {
    const error =
      new Error(
        "No-show training dataset is not ready to freeze: " +
        readiness.blockers.join(
          " "
        )
      );

    error.code =
      rows.length < 30
        ? "INSUFFICIENT_AI_TRAINING_DATA"
        : "AI_TRAINING_DATASET_NOT_READY";
    error.details = {
      blockers:
        readiness.blockers,
      warnings:
        readiness.warnings,
      splitLabelDistribution:
        readiness
          .splitLabelDistribution,
    };

    throw error;
  }

  await AiFeatureSnapshot.deleteMany({
    task: TASK,
    featureVersion:
      FEATURE_VERSION,
    datasetVersion,
  });

  if (cleanRows.length) {
    await AiFeatureSnapshot.insertMany(
      cleanRows,
      {
        ordered: false,
      }
    );
  }

  const dataset =
    await AiTrainingDataset.findOneAndUpdate(
      {
        name:
          DATASET_NAME,
        version:
          datasetVersion,
      },
      {
        $set: {
          task: TASK,
          featureVersion:
            FEATURE_VERSION,
          status: "frozen",
          observationStart:
            summary
              .observationStart,
          observationEnd:
            summary
              .observationEnd,
          snapshotCount:
            rows.length,
          splitStrategy: {
            type:
              "temporal",
            trainBefore:
              rows.find(
                (row) =>
                  row.split ===
                  "validation"
              )?._sortDate ||
              null,
            validationBefore:
              rows.find(
                (row) =>
                  row.split ===
                  "test"
              )?._sortDate ||
              null,
          },
          schemaHash:
            summary.schemaHash,
          lineage: {
            sourceCollections: [
              Appointment
                .collection.name,
            ],
            builderVersion:
              FEATURE_VERSION,
            gitCommit:
              String(
                process.env
                  .GIT_COMMIT_SHA ||
                  ""
              ),
          },
          quality: {
            labelDistribution:
              summary
                .labelDistribution,
            splitLabelDistribution:
              readiness
                .splitLabelDistribution,
            readiness: {
              readyToFreeze:
                readiness
                  .readyToFreeze,
              blockers:
                readiness
                  .blockers,
            },
            warnings:
              readiness.warnings,
          },
          notes:
            "48-hour no-show classification dataset. Cancelled appointments are excluded from labels; payment fields are excluded until timestamped payment history is available.",
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert:
          true,
      }
    );

  return {
    applied: true,
    summary,
    dataset,
  };
}

export {
  DATASET_NAME,
  FEATURE_VERSION,
  PREDICTION_LEAD_HOURS,
  TASK,
};

export default {
  buildNoShowTrainingRows,
  evaluateNoShowDatasetReadiness,
  materialiseNoShowTrainingDataset,
};
