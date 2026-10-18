import crypto from "node:crypto";
import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import Business from "../../models/Business.js";
import Location from "../../models/Location.js";
import AiFeatureSnapshot from "./AiFeatureSnapshot.js";
import AiTrainingDataset from "./AiTrainingDataset.js";
import {
  buildNoShowTrainingRows,
  evaluateNoShowDatasetReadiness,
  DATASET_NAME,
  FEATURE_VERSION,
  PREDICTION_LEAD_HOURS,
  TASK,
} from "./noShowTrainingDatasetService.js";

function requireObjectId(value, fieldName) {
  const text = String(value || "").trim();

  if (!mongoose.isValidObjectId(text)) {
    const error = new Error(`${fieldName} must be a valid ObjectId.`);
    error.code = "INVALID_AI_DATASET_SCOPE";
    throw error;
  }

  return new mongoose.Types.ObjectId(text);
}

function hash(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function labelDistribution(rows) {
  return rows.reduce((summary, row) => {
    const key = String(row.label);
    summary[key] = (summary[key] || 0) + 1;
    return summary;
  }, {});
}

function splitDistribution(rows) {
  return rows.reduce((summary, row) => {
    summary[row.split] = (summary[row.split] || 0) + 1;
    return summary;
  }, {});
}

function schemaHash(rows) {
  const fields = rows.length
    ? Object.keys(rows[0].features || {}).sort()
    : [];
  return hash(fields);
}

function dataHash(rows) {
  return hash(
    rows.map((row) => ({
      entityKey: row.entityKey,
      asOf: row.asOf instanceof Date ? row.asOf.toISOString() : row.asOf,
      label: row.label,
      split: row.split,
      features: row.features,
    }))
  );
}

function scopedDatasetConflict(existing, businessId) {
  if (!existing) return false;

  const mode = String(existing.scope?.mode || "");
  const existingBusiness = String(existing.scope?.business || "");

  return (
    mode !== "single_business" ||
    !existingBusiness ||
    existingBusiness !== String(businessId)
  );
}

export async function resolveNoShowDatasetScope({
  businessId,
  locationId = "",
} = {}) {
  const businessObjectId = requireObjectId(businessId, "businessId");
  const business = await Business.findById(businessObjectId)
    .select("_id")
    .lean();

  if (!business) {
    const error = new Error("The requested Business does not exist.");
    error.code = "AI_DATASET_BUSINESS_NOT_FOUND";
    throw error;
  }

  let locationObjectId = null;

  if (String(locationId || "").trim()) {
    locationObjectId = requireObjectId(locationId, "locationId");
    const location = await Location.findOne({
      _id: locationObjectId,
      business: businessObjectId,
    })
      .select("_id")
      .lean();

    if (!location) {
      const error = new Error(
        "The requested Location is not owned by the trusted Business scope."
      );
      error.code = "AI_DATASET_LOCATION_SCOPE_MISMATCH";
      throw error;
    }
  }

  return {
    businessId: businessObjectId,
    locationId: locationObjectId,
  };
}

export async function materialiseTenantScopedNoShowTrainingDataset({
  datasetVersion,
  pseudonymKey,
  businessId,
  locationId = "",
  apply = false,
} = {}) {
  const version = String(datasetVersion || "").trim();
  const key = String(pseudonymKey || "").trim();

  if (!version) {
    throw new Error("datasetVersion is required.");
  }

  if (key.length < 32) {
    throw new Error("A pseudonym key of at least 32 characters is required.");
  }

  const scope = await resolveNoShowDatasetScope({
    businessId,
    locationId,
  });

  const existingDataset = await AiTrainingDataset.findOne({
    name: DATASET_NAME,
    version,
  })
    .select("_id scope")
    .lean();

  if (scopedDatasetConflict(existingDataset, scope.businessId)) {
    const error = new Error(
      "This dataset name/version already exists without the same trusted single-Business scope. Use a new dataset version rather than re-scoping historical AI data."
    );
    error.code = "AI_TRAINING_DATASET_SCOPE_CONFLICT";
    throw error;
  }

  const appointmentFilter = {
    business: scope.businessId,
    status: {
      $in: ["completed", "no_show", "cancelled"],
    },
  };

  if (scope.locationId) {
    appointmentFilter.location = scope.locationId;
  }

  const appointments = await Appointment.find(appointmentFilter)
    .select(
      "_id business location customer stylist service startsAt appointmentDate appointmentTime duration totalPrice bookingSource status reminderSentAt rescheduleHistory statusHistory completedAt noShowAt cancelledAt createdAt updatedAt"
    )
    .sort({ startsAt: 1, appointmentDate: 1, _id: 1 })
    .lean();

  const sourceById = new Map(
    appointments.map((appointment) => [String(appointment._id), appointment])
  );

  const rows = buildNoShowTrainingRows(appointments, {
    pseudonymKey: key,
  });

  const cleanRows = rows.map(({ _sortDate, ...row }) => {
    const sourceId = String(row.sourceRefs?.[0]?.documentId || "");
    const source = sourceById.get(sourceId);

    return {
      ...row,
      business: scope.businessId,
      ...(source?.location ? { location: source.location } : {}),
      datasetVersion: version,
    };
  });

  const readiness = evaluateNoShowDatasetReadiness(rows);
  const dates = rows.map((row) => row._sortDate);
  const summary = {
    task: TASK,
    datasetName: DATASET_NAME,
    datasetVersion: version,
    featureVersion: FEATURE_VERSION,
    predictionLeadHours: PREDICTION_LEAD_HOURS,
    scope: {
      mode: "single_business",
      business: String(scope.businessId),
      locations: scope.locationId ? [String(scope.locationId)] : [],
    },
    sourceAppointmentCount: appointments.length,
    eligibleSnapshotCount: rows.length,
    labelDistribution: labelDistribution(rows),
    splitDistribution: splitDistribution(rows),
    splitLabelDistribution: readiness.splitLabelDistribution,
    readiness: {
      readyToFreeze: readiness.readyToFreeze,
      blockers: readiness.blockers,
      warnings: readiness.warnings,
    },
    schemaHash: schemaHash(rows),
    dataHash: dataHash(cleanRows),
    observationStart: dates.at(0) || null,
    observationEnd: dates.at(-1) || null,
  };

  if (!apply) {
    return {
      applied: false,
      summary,
      rows: cleanRows,
    };
  }

  if (!readiness.readyToFreeze) {
    const error = new Error(
      "No-show training dataset is not ready to freeze: " +
        readiness.blockers.join(" ")
    );
    error.code =
      rows.length < 30
        ? "INSUFFICIENT_AI_TRAINING_DATA"
        : "AI_TRAINING_DATASET_NOT_READY";
    error.details = {
      blockers: readiness.blockers,
      warnings: readiness.warnings,
      splitLabelDistribution: readiness.splitLabelDistribution,
    };
    throw error;
  }

  await AiFeatureSnapshot.deleteMany({
    business: scope.businessId,
    task: TASK,
    featureVersion: FEATURE_VERSION,
    datasetVersion: version,
  });

  if (cleanRows.length) {
    await AiFeatureSnapshot.insertMany(cleanRows, {
      ordered: false,
    });
  }

  const dataset = await AiTrainingDataset.findOneAndUpdate(
    {
      name: DATASET_NAME,
      version,
    },
    {
      $set: {
        task: TASK,
        featureVersion: FEATURE_VERSION,
        scope: {
          mode: "single_business",
          business: scope.businessId,
          locations: scope.locationId ? [scope.locationId] : [],
          verticals: [],
          deidentified: true,
          governanceBasis:
            "Trusted single-Business operational dataset materialised from canonical tenant-owned Appointment records.",
        },
        status: "frozen",
        observationStart: summary.observationStart,
        observationEnd: summary.observationEnd,
        snapshotCount: rows.length,
        splitStrategy: {
          type: "temporal",
          trainBefore:
            rows.find((row) => row.split === "validation")?._sortDate || null,
          validationBefore:
            rows.find((row) => row.split === "test")?._sortDate || null,
        },
        schemaHash: summary.schemaHash,
        dataHash: summary.dataHash,
        lineage: {
          sourceCollections: [Appointment.collection.name],
          builderVersion: `${FEATURE_VERSION}-tenant-scoped-v1`,
          gitCommit: String(process.env.GIT_COMMIT_SHA || ""),
        },
        quality: {
          labelDistribution: summary.labelDistribution,
          splitLabelDistribution: readiness.splitLabelDistribution,
          readiness: {
            readyToFreeze: readiness.readyToFreeze,
            blockers: readiness.blockers,
          },
          warnings: readiness.warnings,
        },
        notes:
          "Tenant-scoped 48-hour no-show classification dataset. Cancelled appointments are excluded from labels; direct identifiers and unowned appointments are excluded from training snapshots.",
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  return {
    applied: true,
    summary,
    dataset,
  };
}

export default {
  resolveNoShowDatasetScope,
  materialiseTenantScopedNoShowTrainingDataset,
};
