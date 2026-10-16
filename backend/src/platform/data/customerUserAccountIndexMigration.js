import { createHash } from "node:crypto";

export const LEGACY_CUSTOMER_USER_ACCOUNT_INDEX = "userAccount_1";
export const TARGET_CUSTOMER_USER_ACCOUNT_INDEX =
  "userAccount_unique_linked";

export const TARGET_CUSTOMER_USER_ACCOUNT_INDEX_SPEC =
  Object.freeze({
    key: Object.freeze({ userAccount: 1 }),
    options: Object.freeze({
      name: TARGET_CUSTOMER_USER_ACCOUNT_INDEX,
      unique: true,
      partialFilterExpression: Object.freeze({
        userAccount: Object.freeze({
          $type: "objectId",
        }),
      }),
    }),
  });

function canonicalise(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) =>
          left.localeCompare(right)
        )
        .map(([key, child]) => [
          key,
          canonicalise(child),
        ])
    );
  }

  return value;
}

function fingerprint(value) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalise(value)))
    .digest("hex");
}

function sameKey(index = {}) {
  return Number(index?.key?.userAccount) === 1 &&
    Object.keys(index?.key || {}).length === 1;
}

function isDesiredPartialIndex(index = {}) {
  return (
    sameKey(index) &&
    index.unique === true &&
    index?.partialFilterExpression?.userAccount?.$type ===
      "objectId"
  );
}

function sanitiseIndex(index = {}) {
  return {
    name: String(index?.name || ""),
    key: sameKey(index) ? { userAccount: 1 } : index?.key || {},
    unique: index?.unique === true,
    sparse: index?.sparse === true,
    partialObjectId:
      index?.partialFilterExpression?.userAccount?.$type ===
      "objectId",
  };
}

export function buildCustomerUserAccountIndexReadiness({
  indexes = [],
  duplicateLinkedAccountGroups = 0,
} = {}) {
  const relevantIndexes = (Array.isArray(indexes) ? indexes : [])
    .filter(sameKey)
    .map(sanitiseIndex)
    .sort((left, right) => left.name.localeCompare(right.name));

  const legacy = relevantIndexes.find(
    (index) => index.name === LEGACY_CUSTOMER_USER_ACCOUNT_INDEX
  );
  const desired = relevantIndexes.find(
    (index) =>
      index.name === TARGET_CUSTOMER_USER_ACCOUNT_INDEX &&
      index.partialObjectId &&
      index.unique
  );

  const unexpected = relevantIndexes.filter(
    (index) =>
      index.name !== LEGACY_CUSTOMER_USER_ACCOUNT_INDEX &&
      index.name !== TARGET_CUSTOMER_USER_ACCOUNT_INDEX
  );

  const blockers = [];

  if (Number(duplicateLinkedAccountGroups) > 0) {
    blockers.push({
      blocker: "duplicate-linked-user-accounts",
      count: Number(duplicateLinkedAccountGroups),
    });
  }

  if (unexpected.length > 0) {
    blockers.push({
      blocker: "unexpected-user-account-index",
      count: unexpected.length,
    });
  }

  if (legacy && legacy.unique !== true) {
    blockers.push({
      blocker: "legacy-index-not-unique",
    });
  }

  if (desired && !isDesiredPartialIndex({
    key: desired.key,
    unique: desired.unique,
    partialFilterExpression: desired.partialObjectId
      ? { userAccount: { $type: "objectId" } }
      : undefined,
  })) {
    blockers.push({
      blocker: "target-index-options-mismatch",
    });
  }

  const alreadyMigrated = Boolean(desired) && !legacy;

  return Object.freeze({
    safeForMigration: blockers.length === 0,
    alreadyMigrated,
    summary: Object.freeze({
      legacyIndexPresent: Boolean(legacy),
      targetIndexPresent: Boolean(desired),
      relevantIndexCount: relevantIndexes.length,
      duplicateLinkedAccountGroups: Number(
        duplicateLinkedAccountGroups
      ) || 0,
      unexpectedIndexCount: unexpected.length,
    }),
    blockers: Object.freeze(blockers),
    relevantIndexes: Object.freeze(relevantIndexes),
  });
}

export function planCustomerUserAccountIndexMigration(input = {}) {
  const readiness = buildCustomerUserAccountIndexReadiness(input);
  const operations = [];

  if (readiness.safeForMigration && !readiness.alreadyMigrated) {
    if (!readiness.summary.targetIndexPresent) {
      operations.push({
        operation: "create-target-partial-unique-index",
        indexName: TARGET_CUSTOMER_USER_ACCOUNT_INDEX,
      });
    }

    if (readiness.summary.legacyIndexPresent) {
      operations.push({
        operation: "drop-legacy-sparse-unique-index",
        indexName: LEGACY_CUSTOMER_USER_ACCOUNT_INDEX,
      });
    }
  }

  const reviewedState = {
    readiness: {
      summary: readiness.summary,
      relevantIndexes: readiness.relevantIndexes,
      blockers: readiness.blockers,
    },
    operations,
  };

  return Object.freeze({
    readiness,
    operations: Object.freeze(operations),
    operationCount: operations.length,
    fingerprint: fingerprint(reviewedState),
    writesPerformed: false,
  });
}
