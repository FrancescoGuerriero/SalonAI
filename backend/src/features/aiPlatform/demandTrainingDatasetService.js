import crypto from "node:crypto";

import Appointment from "../../models/Appointment.js";
import WorkforceCapacitySnapshot from "../../models/WorkforceCapacitySnapshot.js";
import AiFeatureSnapshot from "./AiFeatureSnapshot.js";
import AiTrainingDataset from "./AiTrainingDataset.js";

export const TASK = "demand_forecasting";
export const FEATURE_VERSION = "demand-forecast-v1";
export const DATASET_NAME = "salonai-demand-forecast";
export const MINIMUM_DAYS = 42;

const DAY_MS = 86_400_000;

function asText(value) {
  return String(value || "").trim();
}

function asDate(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed
    : null;
}

function utcDay(value) {
  const parsed = asDate(value);
  if (!parsed) {
    return null;
  }

  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate()
    )
  );
}

function dayKey(value) {
  return value.toISOString().slice(0, 10);
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function assignTemporalSplits(rows) {
  const trainEnd = Math.max(
    1,
    Math.floor(rows.length * 0.70)
  );
  const validationEnd = Math.max(
    trainEnd + 1,
    Math.floor(rows.length * 0.85)
  );

  return rows.map((row, index) => ({
    ...row,
    split:
      index < trainEnd
        ? "train"
        : index < validationEnd
          ? "validation"
          : "test",
  }));
}

export function buildDemandTrainingRows(
  appointments,
  capacitySnapshots = []
) {
  const eligible = (Array.isArray(appointments) ? appointments : [])
    .map((appointment) => ({
      appointment,
      businessDate: utcDay(
        appointment.startsAt || appointment.appointmentDate
      ),
    }))
    .filter((entry) => entry.businessDate)
    .sort(
      (a, b) =>
        a.businessDate.getTime() - b.businessDate.getTime()
    );

  if (!eligible.length) {
    return [];
  }

  const grouped = new Map();
  for (const { appointment, businessDate } of eligible) {
    const key = dayKey(businessDate);
    const entry = grouped.get(key) || {
      businessDate,
      appointments: [],
    };
    entry.appointments.push(appointment);
    grouped.set(key, entry);
  }

  const capacityByDay = new Map();
  for (const snapshot of Array.isArray(capacitySnapshots)
    ? capacitySnapshots
    : []) {
    const date = utcDay(snapshot?.businessDate);
    if (date) {
      capacityByDay.set(dayKey(date), snapshot);
    }
  }

  const firstDay = eligible[0].businessDate;
  const lastDay = eligible.at(-1).businessDate;
  const rows = [];

  for (
    let cursor = new Date(firstDay);
    cursor.getTime() <= lastDay.getTime();
    cursor = new Date(cursor.getTime() + DAY_MS)
  ) {
    const key = dayKey(cursor);
    const dayAppointments = grouped.get(key)?.appointments || [];
    const capacity = capacityByDay.get(key) || null;
    const booked = dayAppointments.length;
    const completed = dayAppointments.filter(
      (item) => item.status === "completed"
    ).length;
    const cancelled = dayAppointments.filter(
      (item) => item.status === "cancelled"
    ).length;
    const noShow = dayAppointments.filter(
      (item) => item.status === "no_show"
    ).length;

    const sourceRefs = dayAppointments.map((appointment) => ({
      collection: Appointment.collection.name,
      documentId: String(appointment._id),
    }));

    if (capacity?._id) {
      sourceRefs.push({
        collection: WorkforceCapacitySnapshot.collection.name,
        documentId: String(capacity._id),
      });
    }

    rows.push({
      task: TASK,
      entityType: "business_day",
      entityKey: key,
      asOf: new Date(cursor),
      featureVersion: FEATURE_VERSION,
      features: {
        available_staff_hours: Math.max(
          0,
          Number(capacity?.availableStaffHours || 0)
        ),
        appointment_capacity: Math.max(
          0,
          Number(capacity?.appointmentCapacity || 0)
        ),
        completed_appointments: completed,
        cancelled_appointments: cancelled,
        no_show_appointments: noShow,
      },
      label: booked,
      labelObservedAt: new Date(
        cursor.getTime() + DAY_MS - 1
      ),
      sourceRefs,
      privacy: {
        containsDirectIdentifiers: false,
        pseudonymised: true,
        purpose: "model_training_and_evaluation",
      },
      metadata: {
        target: "booked_appointments",
        calendarContinuity: true,
        workforceCapacityJoined: Boolean(capacity),
        workforceCapacitySourceType:
          asText(capacity?.sourceType) || null,
      },
    });
  }

  return assignTemporalSplits(rows);
}

export function evaluateDemandDatasetReadiness(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const blockers = [];
  const warnings = [];

  if (safeRows.length < MINIMUM_DAYS) {
    blockers.push(
      `At least ${MINIMUM_DAYS} continuous daily observations are required.`
    );
  }

  const splitCounts = safeRows.reduce(
    (summary, row) => {
      summary[row.split] = (summary[row.split] || 0) + 1;
      return summary;
    },
    {}
  );

  for (const split of ["train", "validation", "test"]) {
    if (!splitCounts[split]) {
      blockers.push(`Temporal split '${split}' is empty.`);
    }
  }

  if (
    safeRows.length >= MINIMUM_DAYS &&
    safeRows.every((row) => Number(row.label || 0) === 0)
  ) {
    blockers.push(
      "Demand dataset contains no booked appointments."
    );
  }

  const capacityRows = safeRows.filter(
    (row) => row.metadata?.workforceCapacityJoined === true
  ).length;
  const capacityCoverage = safeRows.length
    ? capacityRows / safeRows.length
    : 0;

  if (capacityCoverage === 0) {
    warnings.push(
      "No dated workforce-capacity snapshots are available; candidate training will use appointment-history demand signals only."
    );
  } else if (capacityCoverage < 1) {
    warnings.push(
      `Workforce-capacity coverage is partial (${capacityRows}/${safeRows.length} days); missing days remain explicit zero/unavailable evidence.`
    );
  }

  return {
    readyToFreeze: blockers.length === 0,
    blockers,
    warnings,
    splitCounts,
    capacityCoverage,
    capacityRows,
  };
}

function deterministicRows(rows) {
  return rows.map((row) => ({
    entityKey: row.entityKey,
    asOf: row.asOf.toISOString(),
    featureVersion: row.featureVersion,
    features: row.features,
    label: row.label,
    split: row.split,
  }));
}

export async function materialiseDemandTrainingDataset({
  datasetVersion,
  businessId,
  locationId,
  apply = false,
} = {}) {
  const version = asText(datasetVersion);
  const business = asText(businessId);
  const location = asText(locationId);

  if (!version) {
    throw new Error("datasetVersion is required.");
  }
  if (!business) {
    throw new Error("businessId is required.");
  }
  if (!location) {
    throw new Error("locationId is required.");
  }

  const appointments = await Appointment.find({
    business,
    location,
    appointmentDate: { $ne: null },
  })
    .sort({ appointmentDate: 1, appointmentTime: 1 })
    .lean();

  const capacitySnapshots = await WorkforceCapacitySnapshot.find({
    business,
    location,
  })
    .sort({ businessDate: 1 })
    .lean();

  const rows = buildDemandTrainingRows(
    appointments,
    capacitySnapshots
  );
  const readiness = evaluateDemandDatasetReadiness(rows);
  const dataHash = sha256(
    JSON.stringify(deterministicRows(rows))
  );
  const schemaHash = sha256(
    JSON.stringify([
      "available_staff_hours",
      "appointment_capacity",
      "cancelled_appointments",
      "completed_appointments",
      "no_show_appointments",
    ])
  );

  const summary = {
    datasetVersion: version,
    businessId: business,
    locationId: location,
    rowCount: rows.length,
    dataHash,
    schemaHash,
    readiness,
    apply: Boolean(apply),
  };

  if (!apply) {
    return summary;
  }

  if (!readiness.readyToFreeze) {
    const error = new Error(
      `Demand dataset is not ready to freeze: ${readiness.blockers.join(" ")}`
    );
    error.code = "AI_DEMAND_DATASET_NOT_READY";
    throw error;
  }

  await AiFeatureSnapshot.deleteMany({
    business,
    location,
    task: TASK,
    featureVersion: FEATURE_VERSION,
    datasetVersion: version,
  });

  await AiFeatureSnapshot.insertMany(
    rows.map((row) => ({
      ...row,
      business,
      location,
      datasetVersion: version,
    }))
  );

  const sourceCollections = [Appointment.collection.name];
  if (readiness.capacityRows > 0) {
    sourceCollections.push(
      WorkforceCapacitySnapshot.collection.name
    );
  }

  await AiTrainingDataset.findOneAndUpdate(
    {
      name: DATASET_NAME,
      version,
    },
    {
      name: DATASET_NAME,
      version,
      task: TASK,
      featureVersion: FEATURE_VERSION,
      scope: {
        mode: "single_business",
        business,
        locations: [location],
        verticals: [],
        deidentified: true,
        governanceBasis:
          "AI Core governed offline demand forecasting dataset.",
      },
      status: "frozen",
      observationStart: rows[0].asOf,
      observationEnd: rows.at(-1).asOf,
      snapshotCount: rows.length,
      splitStrategy: {
        type: "temporal",
        trainBefore:
          rows.find((row) => row.split === "validation")?.asOf || null,
        validationBefore:
          rows.find((row) => row.split === "test")?.asOf || null,
      },
      schemaHash,
      dataHash,
      lineage: {
        sourceCollections,
        builderVersion: FEATURE_VERSION,
        gitCommit: asText(process.env.GIT_COMMIT),
      },
      quality: {
        missingFeatureRates: {
          workforceCapacity:
            rows.length > 0
              ? 1 - readiness.capacityCoverage
              : 1,
        },
        labelDistribution: {},
        splitLabelDistribution: readiness.splitCounts,
        readiness: {
          readyToFreeze: true,
          blockers: [],
        },
        warnings: readiness.warnings,
      },
      notes:
        "Continuous daily appointment-demand series. Dated aggregate workforce-capacity snapshots are joined only when governed historical evidence exists; current recurring schedules are never retroactively backfilled as history.",
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return summary;
}

export default {
  buildDemandTrainingRows,
  evaluateDemandDatasetReadiness,
  materialiseDemandTrainingDataset,
};
