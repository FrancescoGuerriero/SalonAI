import { createHash } from "node:crypto";

import {
  buildConsultationLearningRecord,
} from "./consultationLearningRecord.js";

const SNAPSHOT_SCHEMA_VERSION = "consultation-dataset-snapshot-v1";
const RECORD_SCHEMA_VERSION = "consultation-learning-v1";
const ALLOWED_SOURCE_KINDS = new Set([
  "synthetic",
  "test-fixture",
  "approved-governed-export",
]);
const ALLOWED_USE_POLICIES = new Set([
  "evaluation-only",
  "research-development",
]);
const MANIFEST_PRIVACY_FALSE_FIELDS = [
  "rawCustomerIdentifiersIncluded",
  "rawAppointmentIdentifiersIncluded",
  "rawConversationIdentifiersIncluded",
  "rawTranscriptIncluded",
  "freeTextNotesIncluded",
];
const RECORD_PRIVACY_FALSE_FIELDS = [
  "customerIdentifierIncluded",
  "appointmentIdentifierIncluded",
  "conversationIdentifierIncluded",
  "rawTranscriptIncluded",
  "freeTextNotesIncluded",
];

function contractError(message, code = "INVALID_CONSULTATION_DATASET_SNAPSHOT") {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function text(value, field, maxLength = 200) {
  if (typeof value !== "string" || !value.trim()) {
    throw contractError(`${field} is required.`);
  }
  const result = value.trim();
  if (result.length > maxLength) {
    throw contractError(`${field} cannot exceed ${maxLength} characters.`);
  }
  return result;
}

function stableValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

export function stableConsultationDatasetJson(value) {
  return JSON.stringify(stableValue(value));
}

export function fingerprintConsultationDataset(payload) {
  return createHash("sha256")
    .update(stableConsultationDatasetJson(payload))
    .digest("hex");
}

function incrementReason(counter, reason) {
  counter[reason] = (counter[reason] || 0) + 1;
}

function validateSource(source = {}) {
  const kind = text(source.kind, "source.kind", 80);
  if (!ALLOWED_SOURCE_KINDS.has(kind)) {
    throw contractError("source.kind is not supported.");
  }

  const approvalReference = String(source.approvalReference || "").trim();
  if (kind === "approved-governed-export" && !approvalReference) {
    throw contractError(
      "approved-governed-export snapshots require source.approvalReference.",
      "CONSULTATION_DATASET_APPROVAL_REQUIRED"
    );
  }

  return Object.freeze({
    kind,
    approvalReference,
    directProductionDatabaseAccess: false,
  });
}

function validateUsePolicy(value) {
  const usePolicy = text(value || "evaluation-only", "usePolicy", 80);
  if (!ALLOWED_USE_POLICIES.has(usePolicy)) {
    throw contractError("usePolicy is not supported.");
  }
  return usePolicy;
}

function manifestPrivacyValid(privacy) {
  return Boolean(
    privacy &&
      privacy.pseudonymisedKeysOnly === true &&
      MANIFEST_PRIVACY_FALSE_FIELDS.every((field) => privacy[field] === false)
  );
}

function recordPrivacyValid(record) {
  const privacy = record?.privacy;
  return Boolean(
    record?.schemaVersion === RECORD_SCHEMA_VERSION &&
      privacy &&
      RECORD_PRIVACY_FALSE_FIELDS.every((field) => privacy[field] === false)
  );
}

export function buildConsultationDatasetSnapshot(
  sessions = [],
  {
    datasetVersion,
    source,
    usePolicy = "evaluation-only",
    createdAt = new Date(),
  } = {}
) {
  if (!Array.isArray(sessions)) {
    throw contractError("sessions must be an array.");
  }

  const version = text(datasetVersion, "datasetVersion", 120);
  const governedSource = validateSource(source);
  const governedUsePolicy = validateUsePolicy(usePolicy);
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    throw contractError("createdAt must be a valid date.");
  }

  const records = [];
  const exclusionReasons = {};

  for (const session of sessions) {
    const result = buildConsultationLearningRecord(session);
    if (!result.eligible) {
      for (const reason of result.reasons) incrementReason(exclusionReasons, reason);
      continue;
    }
    records.push(result.record);
  }

  records.sort((left, right) =>
    String(left.consultationKey).localeCompare(String(right.consultationKey))
  );

  const fingerprintPayload = Object.freeze({
    snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
    recordSchemaVersion: RECORD_SCHEMA_VERSION,
    datasetVersion: version,
    source: governedSource,
    usePolicy: governedUsePolicy,
    records,
  });

  const fingerprint = fingerprintConsultationDataset(fingerprintPayload);
  const manifest = Object.freeze({
    snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
    recordSchemaVersion: RECORD_SCHEMA_VERSION,
    datasetVersion: version,
    fingerprintAlgorithm: "sha256",
    fingerprint,
    createdAt: created.toISOString(),
    source: governedSource,
    usePolicy: governedUsePolicy,
    trainingAuthorised: false,
    statistics: Object.freeze({
      inputSessions: sessions.length,
      eligibleRecords: records.length,
      excludedSessions: sessions.length - records.length,
      exclusionReasons: Object.freeze(
        Object.fromEntries(
          Object.entries(exclusionReasons).sort(([a], [b]) => a.localeCompare(b))
        )
      ),
    }),
    privacy: Object.freeze({
      pseudonymisedKeysOnly: true,
      rawCustomerIdentifiersIncluded: false,
      rawAppointmentIdentifiersIncluded: false,
      rawConversationIdentifiersIncluded: false,
      rawTranscriptIncluded: false,
      freeTextNotesIncluded: false,
    }),
  });

  return Object.freeze({
    manifest,
    records: Object.freeze(records),
  });
}

export function verifyConsultationDatasetSnapshot(snapshot = {}) {
  const manifest = snapshot?.manifest || {};
  const records = Array.isArray(snapshot?.records) ? snapshot.records : null;
  if (!records) return false;
  if (manifest.snapshotSchemaVersion !== SNAPSHOT_SCHEMA_VERSION) return false;
  if (manifest.recordSchemaVersion !== RECORD_SCHEMA_VERSION) return false;
  if (manifest.fingerprintAlgorithm !== "sha256") return false;
  if (typeof manifest.datasetVersion !== "string" || !manifest.datasetVersion.trim()) {
    return false;
  }
  if (manifest.trainingAuthorised !== false) return false;
  if (!ALLOWED_SOURCE_KINDS.has(manifest.source?.kind)) return false;
  if (manifest.source?.directProductionDatabaseAccess !== false) return false;
  if (
    manifest.source?.kind === "approved-governed-export" &&
    !String(manifest.source?.approvalReference || "").trim()
  ) {
    return false;
  }
  if (!ALLOWED_USE_POLICIES.has(manifest.usePolicy)) return false;
  if (!manifestPrivacyValid(manifest.privacy)) return false;
  if (!records.every(recordPrivacyValid)) return false;

  const statistics = manifest.statistics || {};
  if (statistics.eligibleRecords !== records.length) return false;
  if (
    Number.isInteger(statistics.inputSessions) &&
    Number.isInteger(statistics.excludedSessions) &&
    statistics.inputSessions - statistics.excludedSessions !== records.length
  ) {
    return false;
  }

  const payload = {
    snapshotSchemaVersion: manifest.snapshotSchemaVersion,
    recordSchemaVersion: manifest.recordSchemaVersion,
    datasetVersion: manifest.datasetVersion,
    source: manifest.source,
    usePolicy: manifest.usePolicy,
    records,
  };
  return fingerprintConsultationDataset(payload) === manifest.fingerprint;
}

export default {
  buildConsultationDatasetSnapshot,
  fingerprintConsultationDataset,
  stableConsultationDatasetJson,
  verifyConsultationDatasetSnapshot,
};
