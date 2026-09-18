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
      }) => row
    );

  const dates =
    rows.map(
      (row) =>
        row._sortDate
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
    rows.length < 30
  ) {
    const error =
      new Error(
        "At least 30 eligible historical appointments are required before freezing a no-show training dataset."
      );
    error.code =
      "INSUFFICIENT_AI_TRAINING_DATA";
    throw error;
  }

  await AiFeatureSnapshot.deleteMany({
    task: TASK,
    featureVersion:
      FEATURE_VERSION,
    "metadata.datasetVersion":
      datasetVersion,
  });

  if (cleanRows.length) {
    await AiFeatureSnapshot.insertMany(
      cleanRows.map(
        (row) => ({
          ...row,
          metadata: {
            ...row.metadata,
            datasetVersion,
          },
        })
      ),
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
            warnings:
              rows.length < 100
                ? [
                    "Small dataset: treat model metrics as exploratory until more resolved appointments are available.",
                  ]
                : [],
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
  materialiseNoShowTrainingDataset,
};
