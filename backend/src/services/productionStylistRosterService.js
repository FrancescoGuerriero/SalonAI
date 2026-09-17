const RAW_PRODUCTION_ROSTER = [
  {
    id: "6a5ca62a63a44bb39f326ca5",
    expectedName: "Emma Johnson",
    classification: "employee-non-bookable",
    set: {
      isActive: true,
      acceptsAppointments: false,
      profilePublished: false,
      jobTitle: "Reception",
    },
  },
  {
    id: "6a5cdb0e0189e3e6c92dcffe",
    expectedName: "James Smith",
    classification: "employee-non-bookable",
    set: {
      isActive: true,
      acceptsAppointments: false,
      profilePublished: false,
      jobTitle: "Reception",
    },
  },
  {
    id: "6a5d418c32b90dbeb8b2c070",
    expectedName: "Francesco Guerriero",
    classification: "historical-non-bookable",
    set: {
      isActive: false,
      acceptsAppointments: false,
      profilePublished: false,
    },
  },
  {
    id: "6a7c58f21f777eb49e85dc4a",
    expectedName: "Maya Thompson",
    classification: "employee-non-bookable",
    set: {
      isActive: true,
      acceptsAppointments: false,
      profilePublished: false,
      jobTitle: "Office",
    },
  },
  {
    id: "6a7c5c467c5b74ad029a28f6",
    expectedName: "Luca Romano",
    classification: "employee-non-bookable",
    set: {
      isActive: true,
      acceptsAppointments: false,
      profilePublished: false,
      jobTitle: "Assistant",
    },
  },
  {
    id: "6a7c5c467c5b74ad029a28f9",
    expectedName: "Amara Okafor",
    classification: "bookable",
    set: {
      isActive: true,
      acceptsAppointments: true,
      profilePublished: true,
    },
  },
  {
    id: "6a7c5c467c5b74ad029a28fc",
    expectedName: "Sophie Bennett",
    classification: "bookable",
    set: {
      isActive: true,
      acceptsAppointments: true,
      profilePublished: true,
    },
  },
  {
    id: "6a7c5c467c5b74ad029a28ff",
    expectedName: "Daniel Kim",
    classification: "bookable",
    set: {
      isActive: true,
      acceptsAppointments: true,
      profilePublished: true,
    },
  },
  {
    id: "6a82f7af8f6032b41284da47",
    expectedName: "Francesco Guerriero",
    classification: "bookable",
    set: {
      isActive: true,
      acceptsAppointments: true,
      profilePublished: true,
    },
  },
];

function freezeRoster(roster) {
  return Object.freeze(
    roster.map(
      (entry) =>
        Object.freeze({
          ...entry,
          set: Object.freeze({
            ...entry.set,
          }),
        })
    )
  );
}

export const PRODUCTION_STYLIST_ROSTER =
  freezeRoster(
    RAW_PRODUCTION_ROSTER
  );

/*
 * Legacy application versions infer appointment eligibility from isActive.
 * Before rolling back to such a version, non-bookable staff must therefore be
 * temporarily inactive. The rollback phase writes only isActive, preserving
 * all v8.14.10 classification data for a later PREPARE/deploy/FINALIZE cycle.
 */
export const LEGACY_ROLLBACK_STYLIST_ROSTER =
  freezeRoster(
    RAW_PRODUCTION_ROSTER.map(
      (entry) => ({
        ...entry,
        set: {
          ...entry.set,
          isActive:
            entry.set.acceptsAppointments === true,
        },
      })
    )
  );

function compactText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function resolveRosterRecordName(record) {
  const modernName =
    compactText(
      [
        record?.firstName,
        record?.lastName,
      ]
        .filter(Boolean)
        .join(" ")
    );

  if (modernName) {
    return modernName;
  }

  return compactText(
    record?.name ||
    record?.fullName
  );
}

export function assertRosterDefinition(
  roster = PRODUCTION_STYLIST_ROSTER
) {
  if (!Array.isArray(roster) || roster.length !== 9) {
    throw new Error(
      "Production stylist roster must contain exactly 9 records."
    );
  }

  const ids =
    roster.map(
      (entry) => entry.id
    );

  if (
    new Set(ids).size !== ids.length
  ) {
    throw new Error(
      "Production stylist roster contains duplicate record IDs."
    );
  }

  for (const entry of roster) {
    if (
      !/^[a-f0-9]{24}$/i.test(
        entry.id
      )
    ) {
      throw new Error(
        `Invalid stylist record ID: ${entry.id}`
      );
    }

    if (!compactText(entry.expectedName)) {
      throw new Error(
        `Expected name missing for stylist record ${entry.id}.`
      );
    }

    if (
      typeof entry.set?.isActive !==
        "boolean" ||
      typeof entry.set
        ?.acceptsAppointments !==
        "boolean" ||
      typeof entry.set
        ?.profilePublished !==
        "boolean"
    ) {
      throw new Error(
        `Invalid booking classification for stylist record ${entry.id}.`
      );
    }
  }

  return true;
}

export function inspectRosterRecords(
  records,
  roster = PRODUCTION_STYLIST_ROSTER
) {
  assertRosterDefinition(roster);

  const byId =
    new Map(
      (records || []).map(
        (record) => [
          String(record?._id || ""),
          record,
        ]
      )
    );

  const missing = [];
  const mismatched = [];
  const plan = [];

  for (const target of roster) {
    const record =
      byId.get(target.id);

    if (!record) {
      missing.push({
        id: target.id,
        expectedName:
          target.expectedName,
      });

      continue;
    }

    const actualName =
      resolveRosterRecordName(
        record
      );

    if (
      actualName !==
      target.expectedName
    ) {
      mismatched.push({
        id: target.id,
        expectedName:
          target.expectedName,
        actualName,
      });

      continue;
    }

    const changes = {};

    for (
      const [field, value]
      of Object.entries(target.set)
    ) {
      if (record[field] !== value) {
        changes[field] = value;
      }
    }

    plan.push({
      id: target.id,
      name: actualName,
      classification:
        target.classification,
      changes,
      alreadyCorrect:
        Object.keys(changes)
          .length === 0,
    });
  }

  return {
    safe:
      missing.length === 0 &&
      mismatched.length === 0 &&
      plan.length ===
        roster.length,
    missing,
    mismatched,
    plan,
  };
}

export function assertRosterInspection(
  inspection
) {
  if (inspection?.safe === true) {
    return true;
  }

  const problems = [];

  for (
    const item
    of inspection?.missing || []
  ) {
    problems.push(
      `missing ${item.id} (${item.expectedName})`
    );
  }

  for (
    const item
    of inspection?.mismatched || []
  ) {
    problems.push(
      `identity mismatch ${item.id}: expected "${item.expectedName}", found "${item.actualName}"`
    );
  }

  throw new Error(
    `Production stylist roster preflight failed: ${problems.join("; ")}`
  );
}

export function selectRosterPhaseChanges(
  changes,
  phase
) {
  if (
    phase !== "prepare" &&
    phase !== "finalize" &&
    phase !== "legacy-rollback"
  ) {
    throw new Error(
      `Unsupported production stylist roster phase: ${phase}`
    );
  }

  if (phase === "finalize") {
    return {
      ...changes,
    };
  }

  if (phase === "legacy-rollback") {
    if (
      Object.prototype.hasOwnProperty.call(
        changes,
        "isActive"
      )
    ) {
      return {
        isActive:
          changes.isActive,
      };
    }

    return {};
  }

  if (
    Object.prototype.hasOwnProperty.call(
      changes,
      "acceptsAppointments"
    )
  ) {
    return {
      acceptsAppointments:
        changes.acceptsAppointments,
    };
  }

  return {};
}
