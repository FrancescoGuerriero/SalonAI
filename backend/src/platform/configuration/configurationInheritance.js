function configurationError(
  message,
  code = "INVALID_CONFIGURATION_LAYER"
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function clone(value) {
  if (Array.isArray(value)) {
    return value.map((item) => clone(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clone(item)])
    );
  }

  return value;
}

function normaliseRules(values) {
  if (!Array.isArray(values)) {
    return null;
  }

  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function ruleCoversPath(rule, path) {
  return path === rule || path.startsWith(`${rule}.`);
}

function findLock(path, lockOwners) {
  const matches = Object.entries(lockOwners)
    .filter(([lockedPath]) => ruleCoversPath(lockedPath, path))
    .sort(([left], [right]) => right.length - left.length);

  if (!matches.length) {
    return null;
  }

  const [lockedPath, lockedBy] = matches[0];

  return {
    lockedPath,
    lockedBy,
  };
}

function requiredEntitlementsForPath(path, requirements) {
  if (!isPlainObject(requirements)) {
    return [];
  }

  const required = new Set();

  for (const [rule, values] of Object.entries(requirements)) {
    if (!ruleCoversPath(String(rule || "").trim(), path)) {
      continue;
    }

    const items = Array.isArray(values) ? values : [values];

    for (const item of items) {
      const entitlement = String(item || "").trim();
      if (entitlement) {
        required.add(entitlement);
      }
    }
  }

  return [...required];
}

function isPathAllowed(path, allowedPaths) {
  if (allowedPaths === null) {
    return true;
  }

  return allowedPaths.some((rule) => ruleCoversPath(rule, path));
}

function applyValues({
  target,
  source,
  scope,
  revision,
  prefix = "",
  provenance,
  provenanceDetails,
  lockOwners,
  allowedPaths,
  requirements,
  availableEntitlements,
  blockedOverrides,
}) {
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (isPlainObject(value)) {
      if (!isPlainObject(target[key])) {
        target[key] = {};
      }

      applyValues({
        target: target[key],
        source: value,
        scope,
        revision,
        prefix: path,
        provenance,
        provenanceDetails,
        lockOwners,
        allowedPaths,
        requirements,
        availableEntitlements,
        blockedOverrides,
      });

      if (Object.keys(target[key]).length === 0) {
        delete target[key];
      }

      continue;
    }

    const lock = findLock(path, lockOwners);

    if (lock) {
      blockedOverrides.push({
        scope,
        path,
        reason: "locked",
        lockedPath: lock.lockedPath,
        lockedBy: lock.lockedBy,
      });
      continue;
    }

    if (!isPathAllowed(path, allowedPaths)) {
      blockedOverrides.push({
        scope,
        path,
        reason: "override-not-permitted",
      });
      continue;
    }

    const requiredEntitlements = requiredEntitlementsForPath(
      path,
      requirements
    );
    const missingEntitlements = requiredEntitlements.filter(
      (entitlement) => !availableEntitlements.has(entitlement)
    );

    if (missingEntitlements.length) {
      blockedOverrides.push({
        scope,
        path,
        reason: "missing-entitlement",
        requiredEntitlements,
        missingEntitlements,
      });
      continue;
    }

    target[key] = clone(value);
    provenance[path] = scope;
    provenanceDetails[path] = Object.freeze({
      scope,
      revision: revision || null,
    });
  }
}

export function resolveEffectiveConfiguration(
  layers = [],
  {
    entitlements = [],
    capabilities = [],
  } = {}
) {
  if (!Array.isArray(layers)) {
    throw configurationError("Configuration layers must be an array.");
  }

  const availableEntitlements = new Set(
    [...entitlements, ...capabilities]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );

  const value = {};
  const provenance = {};
  const provenanceDetails = {};
  const lockOwners = {};
  const locks = {};
  const blockedOverrides = [];
  const revisions = [];

  for (const layer of layers) {
    if (!isPlainObject(layer)) {
      throw configurationError("Each configuration layer must be an object.");
    }

    const scope = String(layer.scope || "").trim();

    if (!scope) {
      throw configurationError("Each configuration layer requires a scope.");
    }

    const values =
      layer.values === undefined
        ? {}
        : layer.values;

    if (!isPlainObject(values)) {
      throw configurationError("Configuration layer values must be an object.");
    }

    const allowedPaths =
      layer.allowedPaths === undefined
        ? null
        : normaliseRules(layer.allowedPaths);

    if (layer.allowedPaths !== undefined && allowedPaths === null) {
      throw configurationError(
        "Configuration layer allowedPaths must be an array."
      );
    }

    const requirements =
      layer.requiredEntitlements === undefined
        ? {}
        : layer.requiredEntitlements;

    if (!isPlainObject(requirements)) {
      throw configurationError(
        "Configuration layer requiredEntitlements must be an object."
      );
    }

    const revision = String(layer.revision || "").trim();

    applyValues({
      target: value,
      source: values,
      scope,
      revision,
      provenance,
      provenanceDetails,
      lockOwners,
      allowedPaths,
      requirements,
      availableEntitlements,
      blockedOverrides,
    });

    const layerLocks = normaliseRules(layer.locks || []) || [];

    for (const path of layerLocks) {
      if (!lockOwners[path]) {
        lockOwners[path] = scope;
        locks[path] = scope;
      }
    }

    if (revision) {
      revisions.push(
        Object.freeze({
          scope,
          revision,
        })
      );
    }
  }

  return Object.freeze({
    value: Object.freeze(value),
    provenance: Object.freeze({ ...provenance }),
    provenanceDetails: Object.freeze({ ...provenanceDetails }),
    locks: Object.freeze({ ...locks }),
    blockedOverrides: Object.freeze(
      blockedOverrides.map((item) => Object.freeze({ ...item }))
    ),
    revisions: Object.freeze([...revisions]),
  });
}

export default resolveEffectiveConfiguration;
