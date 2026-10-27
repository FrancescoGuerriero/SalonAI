import AiTrainingDataset from "./AiTrainingDataset.js";
import {
  DATASET_NAME,
  FEATURE_VERSION,
  TASK,
} from "./noShowTrainingDatasetService.js";

const AI_CORE_DATASET_KEY =
  "appointments-history";
const AI_CORE_PURPOSE =
  "no_show_prediction";
const AI_CORE_MANIFEST_CONTRACT =
  "aiibp_training_dataset_manifest_v1";

function asText(value) {
  return String(value || "").trim();
}

function assertSha256(value) {
  const fingerprint =
    asText(value).toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
    const error =
      new Error(
        "Frozen AI training dataset must have a valid SHA-256 dataHash before an AI Core manifest can be issued."
      );
    error.code =
      "AI_TRAINING_DATASET_FINGERPRINT_REQUIRED";
    throw error;
  }

  return fingerprint;
}

export function buildNoShowAiCoreManifest(
  dataset
) {
  if (!dataset) {
    const error =
      new Error(
        "Frozen no-show training dataset is required."
      );
    error.code =
      "AI_TRAINING_DATASET_REQUIRED";
    throw error;
  }

  if (
    asText(dataset.name) !==
      DATASET_NAME ||
    asText(dataset.task) !==
      TASK ||
    asText(dataset.featureVersion) !==
      FEATURE_VERSION ||
    asText(dataset.status) !==
      "frozen"
  ) {
    const error =
      new Error(
        "AI Core manifests may only be issued for the frozen canonical no-show training dataset contract."
      );
    error.code =
      "AI_TRAINING_DATASET_CONTRACT_MISMATCH";
    throw error;
  }

  const scope =
    dataset.scope || {};
  const businessId =
    asText(scope.business);
  const locations =
    Array.isArray(scope.locations)
      ? scope.locations
          .map(asText)
          .filter(Boolean)
      : [];

  if (
    asText(scope.mode) !==
      "single_business" ||
    !businessId
  ) {
    const error =
      new Error(
        "AI Core offline training requires a trusted single-Business frozen dataset."
      );
    error.code =
      "AI_TRAINING_DATASET_BUSINESS_SCOPE_REQUIRED";
    throw error;
  }

  if (locations.length !== 1) {
    const error =
      new Error(
        "AI Core no-show training currently requires exactly one trusted Location per frozen dataset."
      );
    error.code =
      "AI_TRAINING_DATASET_LOCATION_SCOPE_REQUIRED";
    throw error;
  }

  const rowCount =
    Number(dataset.snapshotCount || 0);

  if (
    !Number.isInteger(rowCount) ||
    rowCount < 1
  ) {
    const error =
      new Error(
        "Frozen AI training dataset must contain at least one governed snapshot."
      );
    error.code =
      "AI_TRAINING_DATASET_EMPTY";
    throw error;
  }

  const sourceCollections =
    Array.isArray(
      dataset.lineage?.sourceCollections
    )
      ? dataset.lineage.sourceCollections
          .map(asText)
          .filter(Boolean)
      : [];
  const version =
    asText(dataset.version);

  return {
    contract:
      AI_CORE_MANIFEST_CONTRACT,
    dataset_key:
      AI_CORE_DATASET_KEY,
    business_id:
      businessId,
    location_id:
      locations[0],
    approved_purpose:
      AI_CORE_PURPOSE,
    feature_definition_version:
      FEATURE_VERSION,
    row_count:
      rowCount,
    sha256_fingerprint:
      assertSha256(
        dataset.dataHash
      ),
    generated_at:
      new Date(
        dataset.updatedAt ||
        dataset.createdAt ||
        Date.now()
      ).toISOString(),
    provenance_source_ids:
      [
        `${DATASET_NAME}:${version}`,
        ...sourceCollections.map(
          (collection) =>
            `${DATASET_NAME}:${version}:${collection}`
        ),
      ],
    contains_direct_identifiers:
      false,
    contains_credentials:
      false,
  };
}

export async function loadNoShowAiCoreManifest({
  datasetVersion,
} = {}) {
  const version =
    asText(datasetVersion);

  if (!version) {
    throw new Error(
      "datasetVersion is required."
    );
  }

  const dataset =
    await AiTrainingDataset.findOne({
      name: DATASET_NAME,
      version,
      task: TASK,
      featureVersion:
        FEATURE_VERSION,
      status: "frozen",
    })
      .lean();

  if (!dataset) {
    const error =
      new Error(
        "Frozen no-show training dataset was not found."
      );
    error.code =
      "AI_TRAINING_DATASET_NOT_FOUND";
    throw error;
  }

  return buildNoShowAiCoreManifest(
    dataset
  );
}

export default {
  buildNoShowAiCoreManifest,
  loadNoShowAiCoreManifest,
};
