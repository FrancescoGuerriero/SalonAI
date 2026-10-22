function text(value) {
  return String(value ?? "").trim();
}

export function valueAtPath(root, path) {
  const parts = text(path)
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  let value = root;
  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = value[part];
  }
  return value;
}

export function evaluateWorkflowCondition(condition = {}, context = {}) {
  const actual = valueAtPath(context, condition.path);
  const expected = condition.value;

  switch (condition.operator || "eq") {
    case "eq":
      return actual === expected;
    case "ne":
      return actual !== expected;
    case "exists":
      return Boolean(expected)
        ? actual !== undefined && actual !== null
        : actual === undefined || actual === null;
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "contains":
      return Array.isArray(actual)
        ? actual.includes(expected)
        : String(actual ?? "").includes(String(expected ?? ""));
    default:
      return false;
  }
}

export function evaluateWorkflowConditions(
  conditions = [],
  context = {},
  mode = "all"
) {
  const items = Array.isArray(conditions) ? conditions : [];
  if (items.length === 0) return true;
  const results = items.map((condition) =>
    evaluateWorkflowCondition(condition, context)
  );
  return mode === "any" ? results.some(Boolean) : results.every(Boolean);
}

export function interpolateWorkflowText(template, context = {}) {
  return String(template ?? "").replace(
    /{{\s*([a-zA-Z0-9_.]+)\s*}}/g,
    (_match, path) => {
      const value = valueAtPath(context, path);
      return value === undefined || value === null ? "" : String(value);
    }
  );
}

export default Object.freeze({
  evaluateWorkflowCondition,
  evaluateWorkflowConditions,
  interpolateWorkflowText,
  valueAtPath,
});
