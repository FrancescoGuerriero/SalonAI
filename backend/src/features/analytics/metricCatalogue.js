const METRIC_DEFINITION_VERSION = "2.2.0";

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
  sourceModel = "Appointment",
  denominatorKey = null,
  numeratorMeaning = "",
  denominatorMeaning = "",
  formula = "",
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
    numeratorMeaning,
    denominatorMeaning,
    formula,
    presentationArea,
    evidence: Object.freeze({
      sourceModel,
      sourceFields: freezeArray(sourceFields),
      occurrenceSemantics:
        occurrenceFields.length > 0
          ? "Count the preferred valid occurrence timestamp inside the requested UTC calendar-day window; startsAt is preferred, appointmentDate is the compatibility fallback."
          : "The owning service selects the eligible population; the catalogue governs the metric formula and evidence contract.",
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

export const OPERATIONAL_METRIC_KEYS = Object.freeze([
  "rebook-rate",
  "retention-rate",
  "utilisation-rate",
  "conversion-rate",
]);

export const COMMERCE_METRIC_KEYS = Object.freeze([
  "payment-link-conversion-rate",
  "membership-collection-failure-rate",
  "membership-collection-recovery-rate",
]);

export const GROWTH_METRIC_KEYS = Object.freeze([
  "lead-to-customer-conversion-rate",
  "lead-to-booking-conversion-rate",
  "booking-to-payment-conversion-rate",
  "attributed-net-revenue",
]);

export const CANONICAL_METRIC_KEYS = Object.freeze([
  ...APPOINTMENT_METRIC_KEYS,
  ...OPERATIONAL_METRIC_KEYS,
  ...COMMERCE_METRIC_KEYS,
  ...GROWTH_METRIC_KEYS,
]);

const definitions = {
  bookings: metricDefinition({
    key: "bookings",
    label: "Bookings",
    unit: "count",
    aggregation: "count",
    occurrenceFields: APPOINTMENT_OCCURRENCE_FIELDS,
    statusPolicy: { mode: "all-statuses" },
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
    numeratorMeaning: "Appointments classified as no-show.",
    denominatorMeaning: "All appointments in the selected period.",
    formula: "no_show_appointments / bookings * 100",
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
    numeratorMeaning: "Appointments classified as cancelled.",
    denominatorMeaning: "All appointments in the selected period.",
    formula: "cancelled_appointments / bookings * 100",
  }),
  "rebook-rate": metricDefinition({
    key: "rebook-rate",
    label: "Rebooking rate",
    domain: "retention",
    unit: "percent",
    aggregation: "ratio",
    requiredPermissions: ["appointment:read", "customer:read"],
    sourceModel: "RebookingCampaign / Appointment",
    sourceFields: [
      "recipients",
      "recipients.rebookedAppointment",
      "customer",
      "service",
    ],
    numeratorMeaning: "Eligible customers or campaign recipients who created a subsequent qualifying appointment.",
    denominatorMeaning: "Eligible rebooking opportunities in the selected cohort or campaign.",
    formula: "rebooked_opportunities / eligible_rebooking_opportunities * 100",
    presentationArea: "retention",
  }),
  "retention-rate": metricDefinition({
    key: "retention-rate",
    label: "Customer retention rate",
    domain: "customers",
    unit: "percent",
    aggregation: "ratio",
    requiredPermissions: ["customer:read", "appointment:read"],
    sourceModel: "Appointment / Customer",
    sourceFields: [
      "customer",
      "appointmentDate",
      "startsAt",
      "status",
    ],
    numeratorMeaning: "Active customers in the period who had at least one qualifying appointment before the period.",
    denominatorMeaning: "Distinct customers with at least one qualifying appointment in the period.",
    formula: "returning_active_customers / active_customers * 100",
    presentationArea: "retention",
  }),
  "utilisation-rate": metricDefinition({
    key: "utilisation-rate",
    label: "Staff utilisation rate",
    domain: "operations",
    unit: "percent",
    aggregation: "ratio",
    requiredPermissions: ["appointment:read"],
    sourceModel: "Appointment / Stylist",
    sourceFields: [
      "duration",
      "status",
      "stylist",
      "stylist.workingHours",
    ],
    numeratorMeaning: "Booked service minutes included by the operational capacity policy.",
    denominatorMeaning: "Available scheduled staff minutes for the same population and period.",
    formula: "booked_service_minutes / available_staff_minutes * 100",
    presentationArea: "operations",
  }),
  "conversion-rate": metricDefinition({
    key: "conversion-rate",
    label: "Conversion rate",
    domain: "marketing",
    unit: "percent",
    aggregation: "ratio",
    requiredPermissions: ["appointment:read"],
    sourceModel: "Appointment / Campaign",
    sourceFields: [
      "status",
      "bookingSource",
      "customer",
      "recipients",
      "recipients.rebookedAppointment",
    ],
    numeratorMeaning: "Successful conversion events under the owning funnel's eligibility policy.",
    denominatorMeaning: "Eligible opportunities or attributed booking attempts in that same funnel.",
    formula: "successful_conversions / eligible_opportunities * 100",
    presentationArea: "marketing",
  }),
  "payment-link-conversion-rate": metricDefinition({
    key: "payment-link-conversion-rate",
    label: "Payment-link conversion rate",
    domain: "commerce",
    unit: "percent",
    aggregation: "ratio",
    requiredPermissions: ["appointment:payment:manage", "reports:read"],
    sourceModel: "Payment",
    sourceFields: [
      "sourceType",
      "sourceId",
      "purpose",
      "status",
      "provider",
      "checkoutUrl",
      "createdAt",
      "paidAt",
    ],
    numeratorMeaning: "Provider-hosted payment requests that reconcile to a succeeded/paid canonical Payment.",
    denominatorMeaning: "Distinct eligible payment requests created for the selected cohort and period.",
    formula: "paid_payment_requests / eligible_payment_requests * 100",
    presentationArea: "commerce",
  }),
  "membership-collection-failure-rate": metricDefinition({
    key: "membership-collection-failure-rate",
    label: "Membership collection failure rate",
    domain: "membership",
    unit: "percent",
    aggregation: "ratio",
    requiredPermissions: ["reports:read"],
    sourceModel: "CollectionAttempt / MembershipContract",
    sourceFields: [
      "membershipContract",
      "dueAt",
      "attemptedAt",
      "attemptNumber",
      "status",
      "failureCode",
      "nextRetryAt",
    ],
    numeratorMeaning: "Membership collection cycles whose first attempted collection failed.",
    denominatorMeaning: "Membership collection cycles with an attempted first collection in the selected cohort and period.",
    formula: "failed_first_collection_cycles / attempted_collection_cycles * 100",
    presentationArea: "membership",
  }),
  "membership-collection-recovery-rate": metricDefinition({
    key: "membership-collection-recovery-rate",
    label: "Membership collection recovery rate",
    domain: "membership",
    unit: "percent",
    aggregation: "ratio",
    requiredPermissions: ["reports:read"],
    sourceModel: "CollectionAttempt / MembershipContract",
    sourceFields: [
      "membershipContract",
      "dueAt",
      "attemptedAt",
      "attemptNumber",
      "status",
      "failureCode",
      "nextRetryAt",
    ],
    numeratorMeaning: "Previously failed membership collection cycles that subsequently succeeded within the governed retry lifecycle.",
    denominatorMeaning: "Membership collection cycles that experienced at least one failed attempt and remained eligible for retry.",
    formula: "recovered_failed_collection_cycles / retry_eligible_failed_collection_cycles * 100",
    presentationArea: "membership",
  }),
  "lead-to-customer-conversion-rate": metricDefinition({
    key: "lead-to-customer-conversion-rate",
    label: "Lead-to-customer conversion rate",
    domain: "growth",
    unit: "percent",
    aggregation: "ratio",
    requiredPermissions: ["customer:read", "reports:read"],
    sourceModel: "Lead / Customer",
    sourceFields: [
      "Lead.status",
      "Lead.customer",
      "Lead.createdAt",
      "Lead.convertedAt",
      "Lead.source.channel",
      "Lead.source.campaign",
    ],
    numeratorMeaning: "Captured leads in the selected cohort that are linked to a canonical Customer through the governed conversion workflow.",
    denominatorMeaning: "Distinct captured leads in the selected cohort.",
    formula: "converted_leads / captured_leads * 100",
    presentationArea: "growth",
  }),
  "lead-to-booking-conversion-rate": metricDefinition({
    key: "lead-to-booking-conversion-rate",
    label: "Lead-to-booking conversion rate",
    domain: "growth",
    unit: "percent",
    aggregation: "ratio",
    requiredPermissions: ["customer:read", "appointment:read", "reports:read"],
    sourceModel: "Lead / GrowthAttribution / Appointment",
    sourceFields: [
      "Lead._id",
      "Lead.createdAt",
      "GrowthAttribution.lead",
      "GrowthAttribution.appointment",
      "GrowthAttribution.source.channel",
      "Appointment.status",
    ],
    numeratorMeaning: "Captured leads with at least one immutable, non-conflicting booking attribution.",
    denominatorMeaning: "Distinct captured leads in the selected cohort.",
    formula: "leads_with_attributed_booking / captured_leads * 100",
    presentationArea: "growth",
  }),
  "booking-to-payment-conversion-rate": metricDefinition({
    key: "booking-to-payment-conversion-rate",
    label: "Attributed booking-to-payment conversion rate",
    domain: "growth",
    unit: "percent",
    aggregation: "ratio",
    requiredPermissions: ["reports:read"],
    sourceModel: "GrowthAttribution / Payment",
    sourceFields: [
      "GrowthAttribution.appointment",
      "Payment.appointment",
      "Payment.status",
      "Payment.amount",
      "Payment.refundedAmount",
    ],
    numeratorMeaning: "Attributed bookings with at least one canonical paid payment record.",
    denominatorMeaning: "All bookings represented by immutable GrowthAttribution evidence in the selected cohort.",
    formula: "paid_attributed_bookings / attributed_bookings * 100",
    presentationArea: "growth",
  }),
  "attributed-net-revenue": metricDefinition({
    key: "attributed-net-revenue",
    label: "Attributed net revenue",
    domain: "growth",
    unit: "GBP",
    aggregation: "sum",
    requiredPermissions: ["reports:read"],
    sourceModel: "GrowthAttribution / Payment",
    sourceFields: [
      "GrowthAttribution.lead",
      "GrowthAttribution.appointment",
      "GrowthAttribution.source.channel",
      "GrowthAttribution.source.campaign",
      "Payment.appointment",
      "Payment.amount",
      "Payment.status",
      "Payment.refundedAmount",
    ],
    numeratorMeaning: "Net canonical payment revenue attached to immutably attributed bookings.",
    denominatorMeaning: "Not applicable to this sum metric.",
    formula: "sum(max(0, paid_payment_amount - refunded_amount)) for attributed bookings",
    presentationArea: "growth",
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

export function listMetricDefinitions(keys = CANONICAL_METRIC_KEYS) {
  return Object.freeze(keys.map((key) => getMetricDefinition(key)));
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
    numeratorMeaning: definition.numeratorMeaning,
    denominatorMeaning: definition.denominatorMeaning,
    formula: definition.formula,
  });
}

export default {
  APPOINTMENT_METRIC_KEYS,
  OPERATIONAL_METRIC_KEYS,
  COMMERCE_METRIC_KEYS,
  GROWTH_METRIC_KEYS,
  CANONICAL_METRIC_KEYS,
  METRIC_DEFINITIONS,
  getMetricDefinition,
  listMetricDefinitions,
  metricDefinitionEvidence,
};
