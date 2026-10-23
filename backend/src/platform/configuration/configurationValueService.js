import ConfigValue from "../../models/ConfigValue.js";
import {
  resolveEffectiveConfiguration,
} from "./configurationInheritance.js";

function text(value) {
  return String(value || "").trim();
}

function key(value) {
  return text(value).toLowerCase();
}

function objectIdText(value) {
  if (value && typeof value === "object" && "_id" in value) {
    return text(value._id);
  }

  return text(value);
}

function scopeDescriptor(scopeType, scopeKey) {
  const type = key(scopeType);
  const value = key(scopeKey);

  if (!type || !value) {
    return null;
  }

  return Object.freeze({
    scopeType: type,
    scopeKey: value,
    scope: type === "platform" ? "platform" : `${type}:${value}`,
  });
}

export function buildConfigurationScopeChain({
  businessId,
  businessType = "",
  location = null,
} = {}) {
  const tenantId = objectIdText(businessId);
  const locationId = objectIdText(location);
  const hierarchy = location?.hierarchy || {};

  const scopes = [
    scopeDescriptor("platform", "platform"),
    businessType ? scopeDescriptor("vertical", businessType) : null,
    tenantId ? scopeDescriptor("business", tenantId) : null,
    hierarchy.brandKey ? scopeDescriptor("brand", hierarchy.brandKey) : null,
    hierarchy.regionKey ? scopeDescriptor("region", hierarchy.regionKey) : null,
    hierarchy.zoneKey ? scopeDescriptor("zone", hierarchy.zoneKey) : null,
    locationId ? scopeDescriptor("location", locationId) : null,
    hierarchy.businessUnitKey
      ? scopeDescriptor("business-unit", hierarchy.businessUnitKey)
      : null,
  ].filter(Boolean);

  return Object.freeze(scopes);
}

function setPath(target, path, value) {
  const parts = key(path)
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return;
  }

  let cursor = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (
      cursor[part] === null ||
      typeof cursor[part] !== "object" ||
      Array.isArray(cursor[part])
    ) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }

  cursor[parts.at(-1)] = value;
}

function latestValues(rows = []) {
  const selected = new Map();

  for (const row of [...rows].sort(
    (left, right) => Number(right.version || 0) - Number(left.version || 0)
  )) {
    const identity = [
      key(row.scopeType),
      key(row.scopeKey),
      key(row.configKey),
    ].join("|");

    if (!selected.has(identity)) {
      selected.set(identity, row);
    }
  }

  return [...selected.values()];
}

export function configurationLayersFromValues(
  rows = [],
  scopeChain = []
) {
  const activeRows = latestValues(rows);

  return scopeChain.map((descriptor) => {
    const scopedRows = activeRows.filter(
      (row) =>
        key(row.scopeType) === descriptor.scopeType &&
        key(row.scopeKey) === descriptor.scopeKey
    );

    const values = {};
    const locks = [];
    const revisions = [];

    for (const row of scopedRows) {
      const mode = key(row.inheritanceMode || "override");

      if (mode === "inherit") {
        continue;
      }

      setPath(
        values,
        row.configKey,
        mode === "disabled" ? null : row.value
      );

      if (mode === "locked-by-parent") {
        locks.push(key(row.configKey));
      }

      revisions.push(`${key(row.configKey)}@${Number(row.version || 1)}`);
    }

    return Object.freeze({
      scope: descriptor.scope,
      revision: revisions.sort().join(","),
      values,
      locks,
    });
  });
}

async function findActiveValues({
  businessId,
  scopeChain,
  at,
}) {
  const tenantId = objectIdText(businessId);
  const scopeFilters = scopeChain.map(({ scopeType, scopeKey }) => {
    if (scopeType === "platform") {
      return {
        business: null,
        scopeType,
        scopeKey,
      };
    }

    return {
      business: tenantId,
      scopeType,
      scopeKey,
    };
  });

  if (!scopeFilters.length) {
    return [];
  }

  return ConfigValue.find({
    status: "active",
    $and: [
      {
        $or: scopeFilters,
      },
      {
        $or: [
          { effectiveFrom: null },
          { effectiveFrom: { $lte: at } },
        ],
      },
      {
        $or: [
          { effectiveTo: null },
          { effectiveTo: { $gt: at } },
        ],
      },
    ],
  })
    .sort({
      scopeType: 1,
      scopeKey: 1,
      configKey: 1,
      version: -1,
    })
    .lean();
}

export async function resolvePersistedConfiguration({
  businessId,
  businessType = "",
  location = null,
  entitlements = [],
  capabilities = [],
  at = new Date(),
  findValues = findActiveValues,
} = {}) {
  if (typeof findValues !== "function") {
    throw new TypeError("findValues must be a function.");
  }

  const scopeChain = buildConfigurationScopeChain({
    businessId,
    businessType,
    location,
  });

  const rows = await findValues({
    businessId,
    scopeChain,
    at,
  });

  const layers = configurationLayersFromValues(rows, scopeChain);
  const resolved = resolveEffectiveConfiguration(layers, {
    entitlements,
    capabilities,
  });

  return Object.freeze({
    ...resolved,
    scopeChain,
    sourceValues: Object.freeze([...rows]),
  });
}

export default resolvePersistedConfiguration;
