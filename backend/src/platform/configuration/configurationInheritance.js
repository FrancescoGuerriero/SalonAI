function configurationError(message) {
  const error = new Error(message);
  error.code = "INVALID_CONFIGURATION_LAYER";
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

function pathLocked(path, lockedPaths) {
  return [...lockedPaths].some(
    (locked) =>
      path === locked ||
      path.startsWith(`${locked}.`)
  );
}

function applyValues({
  target,
  source,
  scope,
  prefix = "",
  provenance,
  lockedPaths,
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
        prefix: path,
        provenance,
        lockedPaths,
      });

      continue;
    }

    if (pathLocked(path, lockedPaths)) {
      continue;
    }

    target[key] = clone(value);
    provenance[path] = scope;
  }
}

export function resolveEffectiveConfiguration(layers = []) {
  if (!Array.isArray(layers)) {
    throw configurationError("Configuration layers must be an array.");
  }

  const value = {};
  const provenance = {};
  const lockedPaths = new Set();
  const locks = {};

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

    applyValues({
      target: value,
      source: values,
      scope,
      provenance,
      lockedPaths,
    });

    const layerLocks = Array.isArray(layer.locks)
      ? layer.locks
      : [];

    for (const candidate of layerLocks) {
      const path = String(candidate || "").trim();

      if (!path) {
        continue;
      }

      lockedPaths.add(path);
      locks[path] = scope;
    }
  }

  return Object.freeze({
    value: Object.freeze(value),
    provenance: Object.freeze({ ...provenance }),
    locks: Object.freeze({ ...locks }),
  });
}

export default resolveEffectiveConfiguration;
