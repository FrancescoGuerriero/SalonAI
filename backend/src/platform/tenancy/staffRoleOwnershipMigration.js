import { createHash } from "node:crypto";

import {
  BUILT_IN_STAFF_ROLE_KEYS,
} from "../../services/staffRoleRegistryService.js";

function idOf(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object" && value._id) {
    return idOf(value._id);
  }

  return String(value).trim();
}

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
    .update(
      JSON.stringify(canonicalise(value))
    )
    .digest("hex");
}

export function buildStaffRoleOwnershipReadiness({
  businesses = [],
  staffRoles = [],
  businessId,
} = {}) {
  const targetBusinessId = idOf(businessId);
  const businessIds = [
    ...new Set(
      businesses
        .map((business) => idOf(business))
        .filter(Boolean)
    ),
  ];

  const blockers = [];

  if (!targetBusinessId) {
    blockers.push({
      blocker: "missing-target-business",
    });
  }

  if (
    targetBusinessId &&
    !businessIds.includes(targetBusinessId)
  ) {
    blockers.push({
      blocker: "target-business-not-found",
    });
  }

  if (businessIds.length !== 1) {
    blockers.push({
      blocker: "ambiguous-business-attribution",
      count: businessIds.length,
    });
  }

  let unowned = 0;
  let targetOwned = 0;
  let foreignOwned = 0;
  let builtInOverrides = 0;
  let customRoles = 0;

  for (const role of staffRoles) {
    const owner = idOf(role?.business);
    const key = String(role?.key || "")
      .trim()
      .toLowerCase();

    if (BUILT_IN_STAFF_ROLE_KEYS.includes(key)) {
      builtInOverrides += 1;
    } else {
      customRoles += 1;
    }

    if (!owner) {
      unowned += 1;
      continue;
    }

    if (owner === targetBusinessId) {
      targetOwned += 1;
      continue;
    }

    foreignOwned += 1;
    blockers.push({
      blocker: "foreign-business-owned-role",
      key,
    });
  }

  return Object.freeze({
    safeForBusinessBackfill:
      blockers.length === 0,
    scope: Object.freeze({
      businessCount: businessIds.length,
      staffRoleCount: staffRoles.length,
    }),
    summary: Object.freeze({
      unowned,
      targetOwned,
      foreignOwned,
      builtInOverrides,
      customRoles,
    }),
    blockers: Object.freeze(blockers),
  });
}

export function planStaffRoleOwnershipBackfill({
  businesses = [],
  staffRoles = [],
  businessId,
} = {}) {
  const targetBusinessId = idOf(businessId);
  const readiness = buildStaffRoleOwnershipReadiness({
    businesses,
    staffRoles,
    businessId: targetBusinessId,
  });

  const orderedRoles = [...staffRoles].sort((left, right) =>
    idOf(left).localeCompare(idOf(right))
  );

  const operations = readiness.safeForBusinessBackfill
    ? orderedRoles
        .filter((role) => !idOf(role?.business))
        .map((role) => ({
          roleId: idOf(role),
          businessId: targetBusinessId,
          key: String(role?.key || "")
            .trim()
            .toLowerCase(),
          classification:
            BUILT_IN_STAFF_ROLE_KEYS.includes(
              String(role?.key || "")
                .trim()
                .toLowerCase()
            )
              ? "built-in-override"
              : "custom-role",
        }))
    : [];

  const reviewedState = {
    businessIds: businesses
      .map((business) => idOf(business))
      .filter(Boolean)
      .sort(),
    roles: orderedRoles.map((role) => ({
      id: idOf(role),
      business: idOf(role?.business),
      key: String(role?.key || "")
        .trim()
        .toLowerCase(),
      active: role?.active !== false,
    })),
    operations,
  };

  return Object.freeze({
    readiness,
    operations: Object.freeze(operations),
    operationCount: operations.length,
    rollbackCount: operations.length,
    fingerprint: fingerprint(reviewedState),
    writesPerformed: false,
  });
}
