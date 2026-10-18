const METRIC_DEFINITION_VERSION = "1.0.0";

function freezeArray(values = []) {
  return Object.freeze([...values]);
}

function metricDefinition({
  key,
  label,
  domain = "appointments",
  unit,
  aggregation,
  occurrenceFields = [],
  statusPolicy = {},
  requiredPermissions = [],
  sourceFields = [],
  denominatorKey = null,
  presentationArea = domain,
}) {
  return Object.freeze({
    key,
    version: METRIC_DEFINITION_VERSION,
    label,
    domain,
    unit,
    aggregation,
    occurrenceFields: freezeArray(occurrenceFields),
    statusPolicy: Object.freeze({ ...statusPolicy }),
    requiredPermissions: freezeArray(requiredPermissions),
    denominatorKey,
    presentationArea,
    evidence: Object.freeze({
      sourceModel: "Appointment",
      sourceFields: freezeArray(sourceFields),
      occurrenceSemantics:
        "Count the preferred valid occurrence timestamp inside the requested UTC calendar-day window; startsAt is preferred, appointmentDate is the compatibility fallback.",
    }),
  });
}

const APPOINTMENT_OCCURRENCE_FIELDS = Object.freeze([
  "startsAt",
  "appointmentDate",
]);

const COMMON_SOURCE_FIELDS = Object.freeze([
  "status",
  "appointmentStatus",
  "startsAt",
  "appointmentDate",
]);

const REVENUE_SOURCE_FIELDS = Object.freeze([
  ...COMMON_SOURCE_FIELDS,
  "totalPrice",
  "total",
  "amount",
  "price",
  "service.price",
]);

export const APPOINTMENT_METRIC_KEYS = Object.freeze([
  "bookings",
  "completed",
  "revenue",
  "no-show-rate",
  "cancellation-rate",
]);

const definitions = {
  bookings: metricDefinition({
    key: "bookings",
    label: "Bookings",
    unit: "count",
    aggregation: "count",
    occurrenceFields: APPOINTMENT_OCCURRENCE_FIELDS,
    statusPolicy: {
      mode: "all-statuses",
    },
    requiredPermissions: ["appointment:read"],
    sourceFields: COMMON_SOURCE_FIELDS,
  }),
  completed: metricDefinition({
    key: "completed",
    label: "Completed appointments",
    unit: "count",
    aggregation: "count",
    occurrenceFields: APPOINTMENT_OCCURRENCE_FIELDS,
    statusPolicy: {
      mode: "include",
      statuses: Object.freeze(["completed"]),
    },
    requiredPermissions: ["appointment:read"],
    sourceFields: COMMON_SOURCE_FIELDS,
  }),
  revenue: metricDefinition({
    key: "revenue",
    label: "Completed revenue",
    unit: "GBP",
    aggregation: "sum",
    occurrenceFields: APPOINTMENT_OCCURRENCE_FIELDS,
    statusPolicy: {
      mode: "include",
      statuses: Object.freeze(["completed"]),
      rule: "Only completed appointments contribute to revenue.",
    },
    requiredPermissions: ["appointment:read"],
    sourceFields: REVENUE_SOURCE_FIELDS,
    presentationArea: "revenue",
  }),
  "no-show-rate": metricDefinition({
    key: "no-show-rate",
    label: "No-show rate",
    unit: "percent",
    aggregation: "ratio",
    occurrenceFields: APPOINTMENT_OCCURRENCE_FIELDS,
    statusPolicy: {
      mode: "include",
      statuses: Object.freeze(["no-show", "no_show", "noshow"]),
    },
    requiredPermissions: ["appointment:read"],
    sourceFields: COMMON_SOURCE_FIELDS,
    denominatorKey: "bookings",
  }),
  "cancellation-rate": metricDefinition({
    key: "cancellation-rate",
    label: "Cancellation rate",
    unit: "percent",
    aggregation: "ratio",
    occurrenceFields: APPOINTMENT_OCCURRENCE_FIELDS,
    statusPolicy: {
      mode: "include",
      statuses: Object.freeze(["cancelled", "canceled"]),
    },
    requiredPermissions: ["appointment:read"],
    sourceFields: COMMON_SOURCE_FIELDS,
    denominatorKey: "bookings",
  }),
};

export const METRIC_DEFINITIONS = Object.freeze(definitions);

export function getMetricDefinition(key) {
  const definition = METRIC_DEFINITIONS[String(key || "").trim()];

  if (!definition) {
    const error = new Error(`Unknown canonical metric definition: ${key}`);
    error.code = "METRIC_DEFINITION_NOT_FOUND";
    error.statusCode = 400;
    throw error;
  }

  return definition;
}

export function listMetricDefinitions(keys = APPOINTMENT_METRIC_KEYS) {
  return Object.freeze(
    keys.map((key) => getMetricDefinition(key))
  );
}

export function metricDefinitionEvidence(key) {
  const definition = getMetricDefinition(key);

  return Object.freeze({
    key: definition.key,
    version: definition.version,
    domain: definition.domain,
    aggregation: definition.aggregation,
    occurrenceFields: definition.occurrenceFields,
    statusPolicy: definition.statusPolicy,
    requiredPermissions: definition.requiredPermissions,
    sourceModel: definition.evidence.sourceModel,
    sourceFields: definition.evidence.sourceFields,
  });
}

export default {
  APPOINTMENT_METRIC_KEYS,
  METRIC_DEFINITIONS,
  getMetricDefinition,
  listMetricDefinitions,
  metricDefinitionEvidence,
};
