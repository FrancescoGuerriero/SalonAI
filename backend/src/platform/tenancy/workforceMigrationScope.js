import mongoose from "mongoose";

function idText(value) {
  const candidate =
    value &&
    typeof value === "object" &&
    "_id" in value
      ? value._id
      : value;

  return String(
    candidate || ""
  ).trim();
}

function requiredObjectId(
  value,
  label
) {
  const id =
    idText(
      value
    );

  if (
    !mongoose.Types.ObjectId.isValid(
      id
    )
  ) {
    const error =
      new Error(
        `${label} must be a valid ObjectId.`
      );
    error.code =
      "INVALID_WORKFORCE_MIGRATION_SCOPE";
    error.statusCode =
      400;
    throw error;
  }

  return id;
}

export function buildCanonicalWorkforceMigrationScope({
  businesses = [],
  businessId,
} = {}) {
  const targetBusinessId =
    requiredObjectId(
      businessId,
      "businessId"
    );

  const ids =
    (
      Array.isArray(
        businesses
      )
        ? businesses
        : []
    )
      .map(
        (business) =>
          idText(
            business
          )
      )
      .filter(Boolean);

  const canonicalCount =
    ids.filter(
      (id) =>
        id ===
        targetBusinessId
    ).length;
  const otherBusinessCount =
    ids.filter(
      (id) =>
        id !==
        targetBusinessId
    ).length;

  const blockers = [];

  if (
    canonicalCount !==
      1
  ) {
    blockers.push(
      "canonical-business-count-not-one"
    );
  }

  if (
    otherBusinessCount >
      0
  ) {
    blockers.push(
      "additional-business-present"
    );
  }

  if (
    ids.length !==
      1
  ) {
    blockers.push(
      "global-unowned-workforce-scope-not-single-tenant"
    );
  }

  return Object.freeze({
    businessId:
      targetBusinessId,
    businessCount:
      ids.length,
    canonicalBusinessCount:
      canonicalCount,
    otherBusinessCount,
    safeForGlobalUnownedBackfill:
      blockers.length ===
        0,
    blockers:
      Object.freeze([
        ...blockers,
      ]),
  });
}

export function assertCanonicalWorkforceMigrationScope(
  scope
) {
  if (
    scope?.safeForGlobalUnownedBackfill !==
      true
  ) {
    const error =
      new Error(
        "Global unowned workforce backfill is allowed only while the canonical Business is the sole Business in the database. Use an explicitly reviewed per-record tenant mapping once multiple Businesses exist."
      );
    error.code =
      "WORKFORCE_MIGRATION_SCOPE_NOT_PROVEN";
    error.statusCode =
      409;
    error.scope =
      scope || null;
    throw error;
  }

  return true;
}

export default {
  buildCanonicalWorkforceMigrationScope,
  assertCanonicalWorkforceMigrationScope,
};
