import { createHash } from "node:crypto";

function migrationError(message, code = "INVALID_REPORT_EXPORT_OWNERSHIP_PLAN") {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function idText(value) {
  const candidate =
    value && typeof value === "object" && "_id" in value ? value._id : value;
  return String(candidate || "").trim();
}

function indexById(records = []) {
  return new Map(
    (Array.isArray(records) ? records : [])
      .map((record) => [idText(record), record])
      .filter(([id]) => Boolean(id))
  );
}

function sortedUnique(values = []) {
  return [...new Set(values.map(idText).filter(Boolean))].sort();
}

function addBlocker(blockers, source, recordId, code) {
  blockers.push(
    Object.freeze({
      source,
      recordId: recordId ? String(recordId) : null,
      blocker: code,
    })
  );
}

function linkedRecord({ map, id, source, recordId, blockers, missingCode }) {
  const linkedId = idText(id);
  if (!linkedId) return null;
  const record = map.get(linkedId) || null;
  if (!record) addBlocker(blockers, source, recordId, missingCode);
  return record;
}

function businessFrom(record) {
  return idText(record?.business);
}

function locationFrom(record) {
  return idText(record?.location);
}

function inferOwner({
  source,
  recordId,
  currentBusinessId,
  referencedRecords = [],
  soleBusinessId,
  businessIds,
  blockers,
  allowSoleBusinessFallback = true,
}) {
  const referencedBusinessIds = sortedUnique(
    referencedRecords.map((record) => businessFrom(record))
  );

  if (referencedRecords.some((record) => record && !businessFrom(record))) {
    addBlocker(blockers, source, recordId, "linked-record-business-missing");
  }

  if (referencedBusinessIds.length > 1) {
    addBlocker(blockers, source, recordId, "linked-record-business-conflict");
    return null;
  }

  const inferredBusinessId = referencedBusinessIds[0] || null;

  if (inferredBusinessId && !businessIds.has(inferredBusinessId)) {
    addBlocker(blockers, source, recordId, "linked-business-not-found");
    return null;
  }

  if (
    currentBusinessId &&
    inferredBusinessId &&
    currentBusinessId !== inferredBusinessId
  ) {
    addBlocker(blockers, source, recordId, "existing-business-conflicts-with-provenance");
    return null;
  }

  if (currentBusinessId) return currentBusinessId;
  if (inferredBusinessId) return inferredBusinessId;
  if (allowSoleBusinessFallback && soleBusinessId) return soleBusinessId;

  addBlocker(blockers, source, recordId, "business-ownership-unproven");
  return null;
}

function validateLocation({
  source,
  recordId,
  businessId,
  currentLocationId,
  inferredLocationId,
  locationsById,
  blockers,
}) {
  const candidateLocationId = inferredLocationId || currentLocationId || null;
  if (!candidateLocationId) return null;

  const location = locationsById.get(candidateLocationId);
  if (!location) {
    addBlocker(blockers, source, recordId, "location-not-found");
    return null;
  }

  if (businessFrom(location) !== businessId) {
    addBlocker(blockers, source, recordId, "location-business-conflict");
    return null;
  }

  if (
    currentLocationId &&
    inferredLocationId &&
    currentLocationId !== inferredLocationId
  ) {
    addBlocker(blockers, source, recordId, "existing-location-conflicts-with-provenance");
    return null;
  }

  return candidateLocationId;
}

function makeOperation({ source, record, businessId, locationId = null, allowLocation = false }) {
  const recordId = idText(record);
  const currentBusinessId = businessFrom(record);
  const currentLocationId = locationFrom(record);
  const set = {};
  const expected = {
    business: currentBusinessId || null,
  };

  if (!currentBusinessId && businessId) set.business = businessId;

  if (allowLocation) {
    expected.location = currentLocationId || null;
    if (!currentLocationId && locationId) set.location = locationId;
  }

  if (Object.keys(set).length === 0) return null;

  return Object.freeze({
    source,
    recordId,
    expected: Object.freeze(expected),
    set: Object.freeze(set),
  });
}

function rollbackFor(operation) {
  const unset = Object.keys(operation.set).sort();
  return Object.freeze({
    source: operation.source,
    recordId: operation.recordId,
    unset: Object.freeze(unset),
  });
}

function sourceSummary(source, records, operations, blockers) {
  return Object.freeze({
    total: records.length,
    plannedUpdates: operations.filter((entry) => entry.source === source).length,
    blockers: blockers.filter((entry) => entry.source === source).length,
  });
}

export function canonicaliseReportExportFingerprintValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => canonicaliseReportExportFingerprintValue(entry))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicaliseReportExportFingerprintValue(value[key])])
    );
  }

  return value;
}

export function calculateReportExportBackfillFingerprint(plan) {
  return createHash("sha256")
    .update(JSON.stringify(canonicaliseReportExportFingerprintValue(plan || null)))
    .digest("hex");
}

export function buildReportExportOwnershipBackfillPlan(snapshot = {}) {
  const businesses = Array.isArray(snapshot.businesses) ? snapshot.businesses : [];
  const locations = Array.isArray(snapshot.locations) ? snapshot.locations : [];
  const customers = Array.isArray(snapshot.customers) ? snapshot.customers : [];
  const appointments = Array.isArray(snapshot.appointments) ? snapshot.appointments : [];
  const services = Array.isArray(snapshot.services) ? snapshot.services : [];
  const stylists = Array.isArray(snapshot.stylists) ? snapshot.stylists : [];

  const customerContactLogs = Array.isArray(snapshot.customerContactLogs)
    ? snapshot.customerContactLogs
    : [];
  const campaigns = Array.isArray(snapshot.campaigns) ? snapshot.campaigns : [];
  const rebookingCampaigns = Array.isArray(snapshot.rebookingCampaigns)
    ? snapshot.rebookingCampaigns
    : [];
  const inventoryItems = Array.isArray(snapshot.inventoryItems)
    ? snapshot.inventoryItems
    : [];
  const customerFeedback = Array.isArray(snapshot.customerFeedback)
    ? snapshot.customerFeedback
    : [];
  const exportAuditEvents = Array.isArray(snapshot.exportAuditEvents)
    ? snapshot.exportAuditEvents
    : [];

  const businessIds = new Set(businesses.map(idText).filter(Boolean));
  const soleBusinessId = businessIds.size === 1 ? [...businessIds][0] : null;
  const locationsById = indexById(locations);
  const customersById = indexById(customers);
  const appointmentsById = indexById(appointments);
  const servicesById = indexById(services);
  const stylistsById = indexById(stylists);

  const blockers = [];
  const operations = [];

  // #309 consumes #380 rather than duplicating it. Fail closed until every
  // Customer is Business-owned and every Appointment is Business+Location-owned.
  for (const customer of customers) {
    if (!businessFrom(customer)) {
      addBlocker(blockers, "customers", idText(customer), "customer-business-missing");
    }
  }
  for (const appointment of appointments) {
    if (!businessFrom(appointment)) {
      addBlocker(blockers, "appointments", idText(appointment), "appointment-business-missing");
    }
    if (!locationFrom(appointment)) {
      addBlocker(blockers, "appointments", idText(appointment), "appointment-location-missing");
    }
  }

  function pushOperation(operation) {
    if (operation) operations.push(operation);
  }

  function validateAppointmentProvenance(source, recordId, appointment) {
    if (!appointment) return null;
    const appointmentBusinessId = businessFrom(appointment);
    const appointmentLocationId = locationFrom(appointment);

    if (!appointmentBusinessId) {
      addBlocker(blockers, source, recordId, "linked-appointment-business-missing");
      return null;
    }

    if (!appointmentLocationId) {
      addBlocker(blockers, source, recordId, "linked-appointment-location-missing");
      return null;
    }

    const location = locationsById.get(appointmentLocationId);
    if (!location || businessFrom(location) !== appointmentBusinessId) {
      addBlocker(blockers, source, recordId, "linked-appointment-location-invalid");
      return null;
    }

    return appointmentLocationId;
  }

  for (const record of customerContactLogs) {
    const source = "customerContactLogs";
    const recordId = idText(record);
    const localBlockerStart = blockers.length;
    const customer = linkedRecord({
      map: customersById,
      id: record?.customer,
      source,
      recordId,
      blockers,
      missingCode: "customer-reference-missing",
    });
    const appointment = linkedRecord({
      map: appointmentsById,
      id: record?.appointment,
      source,
      recordId,
      blockers,
      missingCode: "appointment-reference-missing",
    });

    if (!idText(record?.customer)) {
      addBlocker(blockers, source, recordId, "customer-reference-required");
    }

    const referenced = [customer, appointment].filter(Boolean);
    const businessId = inferOwner({
      source,
      recordId,
      currentBusinessId: businessFrom(record),
      referencedRecords: referenced,
      soleBusinessId,
      businessIds,
      blockers,
      allowSoleBusinessFallback: false,
    });
    const inferredLocationId = validateAppointmentProvenance(source, recordId, appointment);
    const locationId = businessId
      ? validateLocation({
          source,
          recordId,
          businessId,
          currentLocationId: locationFrom(record),
          inferredLocationId,
          locationsById,
          blockers,
        })
      : null;

    if (blockers.length === localBlockerStart) {
      pushOperation(
        makeOperation({
          source,
          record,
          businessId,
          locationId,
          allowLocation: true,
        })
      );
    }
  }

  for (const record of campaigns) {
    const source = "campaigns";
    const recordId = idText(record);
    const localBlockerStart = blockers.length;
    const recipientIds = Array.isArray(record?.recipients) ? record.recipients : [];
    const referenced = recipientIds
      .map((id) =>
        linkedRecord({
          map: customersById,
          id,
          source,
          recordId,
          blockers,
          missingCode: "recipient-customer-missing",
        })
      )
      .filter(Boolean);

    const businessId = inferOwner({
      source,
      recordId,
      currentBusinessId: businessFrom(record),
      referencedRecords: referenced,
      soleBusinessId,
      businessIds,
      blockers,
      allowSoleBusinessFallback: recipientIds.length === 0,
    });

    if (blockers.length === localBlockerStart) {
      pushOperation(makeOperation({ source, record, businessId }));
    }
  }

  for (const record of rebookingCampaigns) {
    const source = "rebookingCampaigns";
    const recordId = idText(record);
    const localBlockerStart = blockers.length;
    const recipients = Array.isArray(record?.recipients) ? record.recipients : [];
    const referenced = [];

    for (const recipient of recipients) {
      for (const [map, id, missingCode] of [
        [customersById, recipient?.customer, "recipient-customer-missing"],
        [servicesById, recipient?.service, "recipient-service-missing"],
        [appointmentsById, recipient?.rebookedAppointment, "recipient-appointment-missing"],
      ]) {
        const linked = linkedRecord({ map, id, source, recordId, blockers, missingCode });
        if (linked) referenced.push(linked);
      }
    }

    const hasReferences = recipients.some(
      (recipient) =>
        idText(recipient?.customer) ||
        idText(recipient?.service) ||
        idText(recipient?.rebookedAppointment)
    );
    const businessId = inferOwner({
      source,
      recordId,
      currentBusinessId: businessFrom(record),
      referencedRecords: referenced,
      soleBusinessId,
      businessIds,
      blockers,
      allowSoleBusinessFallback: !hasReferences,
    });

    if (blockers.length === localBlockerStart) {
      pushOperation(makeOperation({ source, record, businessId }));
    }
  }

  for (const record of inventoryItems) {
    const source = "inventoryItems";
    const recordId = idText(record);
    const localBlockerStart = blockers.length;
    const businessId = inferOwner({
      source,
      recordId,
      currentBusinessId: businessFrom(record),
      referencedRecords: [],
      soleBusinessId,
      businessIds,
      blockers,
      allowSoleBusinessFallback: true,
    });

    if (blockers.length === localBlockerStart) {
      // Location remains intentionally untouched: legacy inventory may be
      // Business-wide/shared stock until the dedicated inventory contract is activated.
      pushOperation(makeOperation({ source, record, businessId }));
    }
  }

  for (const record of customerFeedback) {
    const source = "customerFeedback";
    const recordId = idText(record);
    const localBlockerStart = blockers.length;
    const customer = linkedRecord({
      map: customersById,
      id: record?.customer,
      source,
      recordId,
      blockers,
      missingCode: "customer-reference-missing",
    });
    const appointment = linkedRecord({
      map: appointmentsById,
      id: record?.appointment,
      source,
      recordId,
      blockers,
      missingCode: "appointment-reference-missing",
    });
    const service = linkedRecord({
      map: servicesById,
      id: record?.service,
      source,
      recordId,
      blockers,
      missingCode: "service-reference-missing",
    });
    const stylist = linkedRecord({
      map: stylistsById,
      id: record?.stylist,
      source,
      recordId,
      blockers,
      missingCode: "stylist-reference-missing",
    });
    const referenced = [customer, appointment, service, stylist].filter(Boolean);
    const businessId = inferOwner({
      source,
      recordId,
      currentBusinessId: businessFrom(record),
      referencedRecords: referenced,
      soleBusinessId,
      businessIds,
      blockers,
      allowSoleBusinessFallback: referenced.length === 0,
    });
    const inferredLocationId = validateAppointmentProvenance(source, recordId, appointment);
    const locationId = businessId
      ? validateLocation({
          source,
          recordId,
          businessId,
          currentLocationId: locationFrom(record),
          inferredLocationId,
          locationsById,
          blockers,
        })
      : null;

    if (blockers.length === localBlockerStart) {
      pushOperation(
        makeOperation({
          source,
          record,
          businessId,
          locationId,
          allowLocation: true,
        })
      );
    }
  }

  for (const record of exportAuditEvents) {
    const source = "exportAuditEvents";
    const recordId = idText(record);
    const localBlockerStart = blockers.length;
    const businessId = inferOwner({
      source,
      recordId,
      currentBusinessId: businessFrom(record),
      referencedRecords: [],
      soleBusinessId,
      businessIds,
      blockers,
      allowSoleBusinessFallback: true,
    });

    if (businessFrom(record) && locationFrom(record)) {
      validateLocation({
        source,
        recordId,
        businessId,
        currentLocationId: locationFrom(record),
        inferredLocationId: null,
        locationsById,
        blockers,
      });
    }

    if (blockers.length === localBlockerStart) {
      // Historical audit events without trusted location provenance remain
      // explicitly Business-wide rather than inventing a Location.
      pushOperation(makeOperation({ source, record, businessId }));
    }
  }

  const orderedOperations = operations
    .slice()
    .sort((left, right) =>
      `${left.source}:${left.recordId}`.localeCompare(`${right.source}:${right.recordId}`)
    );
  const orderedBlockers = blockers
    .slice()
    .sort((left, right) =>
      `${left.source}:${left.recordId || ""}:${left.blocker}`.localeCompare(
        `${right.source}:${right.recordId || ""}:${right.blocker}`
      )
    );
  const rollback = orderedOperations.map(rollbackFor);

  const sources = {
    customerContactLogs: sourceSummary(
      "customerContactLogs",
      customerContactLogs,
      orderedOperations,
      orderedBlockers
    ),
    campaigns: sourceSummary("campaigns", campaigns, orderedOperations, orderedBlockers),
    rebookingCampaigns: sourceSummary(
      "rebookingCampaigns",
      rebookingCampaigns,
      orderedOperations,
      orderedBlockers
    ),
    inventoryItems: sourceSummary(
      "inventoryItems",
      inventoryItems,
      orderedOperations,
      orderedBlockers
    ),
    customerFeedback: sourceSummary(
      "customerFeedback",
      customerFeedback,
      orderedOperations,
      orderedBlockers
    ),
    exportAuditEvents: sourceSummary(
      "exportAuditEvents",
      exportAuditEvents,
      orderedOperations,
      orderedBlockers
    ),
  };

  return Object.freeze({
    dryRun: true,
    writesPerformed: false,
    executable: orderedBlockers.length === 0,
    blocked: orderedBlockers.length > 0,
    businessCount: businessIds.size,
    sources: Object.freeze(sources),
    summary: Object.freeze({
      operationCount: orderedOperations.length,
      rollbackCount: rollback.length,
      blockerCount: orderedBlockers.length,
    }),
    operations: Object.freeze(orderedOperations),
    rollback: Object.freeze(rollback),
    blockers: Object.freeze(orderedBlockers),
  });
}

export function sanitiseReportExportBackfillPlan(plan) {
  if (!plan || typeof plan !== "object") {
    throw migrationError("Report/export ownership plan is required.");
  }

  const blockerCounts = {};
  const operationCounts = {};

  for (const blocker of plan.blockers || []) {
    const key = `${blocker.source}:${blocker.blocker}`;
    blockerCounts[key] = (blockerCounts[key] || 0) + 1;
  }
  for (const operation of plan.operations || []) {
    operationCounts[operation.source] = (operationCounts[operation.source] || 0) + 1;
  }

  return Object.freeze({
    dryRun: true,
    writesPerformed: false,
    databaseWrites: false,
    piiIncluded: false,
    identifiersIncluded: false,
    executable: plan.executable === true,
    blocked: plan.blocked === true,
    businessCount: Number(plan.businessCount || 0),
    sources: plan.sources || {},
    summary: plan.summary || {},
    operationCounts: Object.freeze(operationCounts),
    blockerCounts: Object.freeze(blockerCounts),
    planFingerprint: calculateReportExportBackfillFingerprint(plan),
  });
}

export default {
  buildReportExportOwnershipBackfillPlan,
  calculateReportExportBackfillFingerprint,
  sanitiseReportExportBackfillPlan,
};
