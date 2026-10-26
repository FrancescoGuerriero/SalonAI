import mongoose from "mongoose";

import Appointment from "../../../models/Appointment.js";
import Customer from "../../../models/customer.js";
import Location from "../../../models/Location.js";
import ClientTechnicalServiceRecord from "./ClientTechnicalServiceRecord.js";

function point9Error(message, statusCode = 400, code = "POINT9_CRM_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function idText(value) {
  if (!value) return "";
  return String(value?._id || value).trim();
}

function uniqueIds(values = []) {
  return Array.from(new Set(values.map(idText).filter(Boolean)));
}

function assertObjectId(value, label) {
  const text = idText(value);
  if (!mongoose.isValidObjectId(text)) {
    throw point9Error(`${label} is invalid.`, 400, "POINT9_INVALID_ID");
  }
  return text;
}

export function point9AuthorityScope(effectiveAuthority = {}) {
  const businessId = assertObjectId(effectiveAuthority.businessId, "Business authority");
  const allLocations = effectiveAuthority.locationAccessMode === "all";
  const selectedLocationId = idText(effectiveAuthority.locationId);
  const allowedLocationIds = allLocations
    ? null
    : uniqueIds([
        selectedLocationId,
        ...(Array.isArray(effectiveAuthority.allowedLocationIds)
          ? effectiveAuthority.allowedLocationIds
          : []),
      ]);

  if (!allLocations && allowedLocationIds.length === 0) {
    throw point9Error(
      "Location authority is required for CRM operational evidence.",
      403,
      "POINT9_LOCATION_AUTHORITY_REQUIRED"
    );
  }

  return {
    businessId,
    scopeMode: allLocations ? "business-wide" : "selected-locations",
    selectedLocationId: selectedLocationId || null,
    allowedLocationIds,
  };
}

function locationFilter(scope) {
  return scope.allowedLocationIds === null
    ? {}
    : { location: { $in: scope.allowedLocationIds } };
}

async function resolveMutationLocation(scope, requestedLocationId) {
  const requested = idText(requestedLocationId);
  let locationId = requested || scope.selectedLocationId || "";

  if (!locationId && Array.isArray(scope.allowedLocationIds) && scope.allowedLocationIds.length === 1) {
    [locationId] = scope.allowedLocationIds;
  }

  if (!locationId) {
    throw point9Error(
      "A specific location is required to create CRM technical evidence.",
      400,
      "POINT9_MUTATION_LOCATION_REQUIRED"
    );
  }

  assertObjectId(locationId, "Location");

  if (
    Array.isArray(scope.allowedLocationIds) &&
    !scope.allowedLocationIds.includes(locationId)
  ) {
    throw point9Error(
      "The requested location is outside the caller's effective authority.",
      403,
      "POINT9_LOCATION_FORBIDDEN"
    );
  }

  const location = await Location.findOne({ _id: locationId, business: scope.businessId })
    .select("_id business name")
    .lean();
  if (!location) {
    throw point9Error(
      "The requested location does not belong to the active business.",
      404,
      "POINT9_LOCATION_NOT_FOUND"
    );
  }

  return location;
}

async function loadBusinessCustomer(customerId, businessId) {
  const id = assertObjectId(customerId, "Customer");
  const customer = await Customer.findOne({
    _id: id,
    business: businessId,
    status: { $ne: "deleted" },
  })
    .select("_id business firstName lastName preferredName email phone status")
    .lean();
  if (!customer) {
    throw point9Error(
      "Customer was not found in the active business.",
      404,
      "POINT9_CUSTOMER_NOT_FOUND"
    );
  }
  return customer;
}

export async function listClientTechnicalRecords(
  customerId,
  { effectiveAuthority = {}, limit = 100 } = {}
) {
  const scope = point9AuthorityScope(effectiveAuthority);
  const customer = await loadBusinessCustomer(customerId, scope.businessId);
  const safeLimit = Math.min(250, Math.max(1, Number.parseInt(limit, 10) || 100));

  const records = await ClientTechnicalServiceRecord.find({
    business: scope.businessId,
    customer: customer._id,
    status: "active",
    ...locationFilter(scope),
  })
    .sort({ occurredAt: -1, createdAt: -1, _id: -1 })
    .limit(safeLimit)
    .populate("location", "name")
    .populate("service", "name category")
    .populate("stylist", "name firstName lastName")
    .select(
      "business location customer appointment service stylist recordType occurredAt formula technicalNotes resultNotes patchTest photos source createdBy updatedBy createdAt updatedAt"
    )
    .lean();

  return {
    customer,
    records,
    count: records.length,
    authority: {
      businessId: scope.businessId,
      scopeMode: scope.scopeMode,
      locationIds: scope.allowedLocationIds,
    },
  };
}

export async function createClientTechnicalRecord(
  customerId,
  payload = {},
  { effectiveAuthority = {}, actorId = null } = {}
) {
  const scope = point9AuthorityScope(effectiveAuthority);
  const customer = await loadBusinessCustomer(customerId, scope.businessId);
  const location = await resolveMutationLocation(scope, payload.locationId || payload.location);

  let appointment = null;
  if (payload.appointmentId || payload.appointment) {
    const appointmentId = assertObjectId(payload.appointmentId || payload.appointment, "Appointment");
    appointment = await Appointment.findOne({
      _id: appointmentId,
      business: scope.businessId,
      location: location._id,
      customer: customer._id,
    })
      .select("_id business location customer service stylist startsAt appointmentDate")
      .lean();
    if (!appointment) {
      throw point9Error(
        "Appointment does not match the selected business, location and customer.",
        409,
        "POINT9_APPOINTMENT_OWNERSHIP_MISMATCH"
      );
    }
  }

  const formula = Array.isArray(payload.formula) ? payload.formula.slice(0, 20) : [];
  const photos = Array.isArray(payload.photos) ? payload.photos.slice(0, 20) : [];
  const actor = mongoose.isValidObjectId(idText(actorId)) ? idText(actorId) : null;

  const record = await ClientTechnicalServiceRecord.create({
    business: scope.businessId,
    location: location._id,
    customer: customer._id,
    appointment: appointment?._id || null,
    service: payload.serviceId || payload.service || appointment?.service || null,
    stylist: payload.stylistId || payload.stylist || appointment?.stylist || null,
    recordType: payload.recordType || "general",
    occurredAt:
      payload.occurredAt || appointment?.startsAt || appointment?.appointmentDate || new Date(),
    formula,
    technicalNotes: payload.technicalNotes || "",
    resultNotes: payload.resultNotes || "",
    patchTest: payload.patchTest || {},
    photos,
    source: appointment ? "appointment" : payload.source || "manual",
    createdBy: actor,
    updatedBy: actor,
  });

  return record.toObject();
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  const first = new Date(a);
  const second = new Date(b);
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return null;
  return Math.max(0, Math.floor((second - first) / 86400000));
}

function retentionState({ lastVisit, nextAppointment, cadenceDays, now }) {
  if (nextAppointment) return "booked";
  const daysSinceLastVisit = daysBetween(lastVisit, now);
  if (daysSinceLastVisit === null) return "no_visit_history";
  const due = cadenceDays;
  if (daysSinceLastVisit >= Math.max(90, due + 30)) return "dormant";
  if (daysSinceLastVisit >= due + 14) return "overdue";
  if (daysSinceLastVisit >= due) return "due";
  if (daysSinceLastVisit >= Math.max(30, due - 14)) return "approaching_due";
  return "healthy";
}

export async function listRetentionQueue({
  effectiveAuthority = {},
  now = new Date(),
  limit = 250,
  state = "",
} = {}) {
  const scope = point9AuthorityScope(effectiveAuthority);
  const safeLimit = Math.min(500, Math.max(1, Number.parseInt(limit, 10) || 250));
  const completed = await Appointment.find({
    business: scope.businessId,
    status: "completed",
    ...locationFilter(scope),
  })
    .sort({ startsAt: -1, appointmentDate: -1, _id: -1 })
    .limit(5000)
    .select("customer location service stylist startsAt appointmentDate price")
    .lean();

  const customerIds = uniqueIds(completed.map((item) => item.customer));
  if (!customerIds.length) {
    return {
      queue: [],
      count: 0,
      generatedAt: now.toISOString(),
      deterministic: true,
      executionAuthorised: false,
    };
  }

  const upcoming = await Appointment.find({
    business: scope.businessId,
    customer: { $in: customerIds },
    status: { $nin: ["completed", "cancelled", "no_show"] },
    $or: [{ startsAt: { $gte: now } }, { appointmentDate: { $gte: now } }],
    ...locationFilter(scope),
  })
    .sort({ startsAt: 1, appointmentDate: 1, _id: 1 })
    .select("customer location startsAt appointmentDate")
    .lean();

  const customers = await Customer.find({
    _id: { $in: customerIds },
    business: scope.businessId,
    status: { $ne: "deleted" },
  })
    .select("firstName lastName preferredName email phone tags totalSpent completedAppointmentCount visitCount")
    .lean();
  const customerById = new Map(customers.map((item) => [idText(item._id), item]));
  const nextByCustomer = new Map();
  for (const item of upcoming) {
    const key = idText(item.customer);
    if (!nextByCustomer.has(key)) nextByCustomer.set(key, item);
  }

  const history = new Map();
  for (const appointment of completed) {
    const key = idText(appointment.customer);
    if (!history.has(key)) history.set(key, []);
    history.get(key).push(appointment);
  }

  const queue = [];
  for (const [customerId, visits] of history.entries()) {
    const customer = customerById.get(customerId);
    if (!customer) continue;
    const recentVisits = visits.slice(0, 6);
    const intervals = [];
    for (let index = 0; index < recentVisits.length - 1; index += 1) {
      const newer = recentVisits[index].startsAt || recentVisits[index].appointmentDate;
      const older = recentVisits[index + 1].startsAt || recentVisits[index + 1].appointmentDate;
      const interval = daysBetween(older, newer);
      if (interval && interval > 0 && interval <= 365) intervals.push(interval);
    }
    const observedCadence = median(intervals);
    const cadenceDays = Math.min(180, Math.max(21, observedCadence || 56));
    const lastVisit = recentVisits[0].startsAt || recentVisits[0].appointmentDate || null;
    const next = nextByCustomer.get(customerId) || null;
    const nextAppointment = next?.startsAt || next?.appointmentDate || null;
    const derivedState = retentionState({ lastVisit, nextAppointment, cadenceDays, now });
    if (state && derivedState !== state) continue;

    const daysSinceLastVisit = daysBetween(lastVisit, now);
    const dueAt = lastVisit
      ? new Date(new Date(lastVisit).getTime() + cadenceDays * 86400000)
      : null;

    queue.push({
      customerId,
      customer: {
        name:
          customer.preferredName ||
          [customer.firstName, customer.lastName].filter(Boolean).join(" "),
        email: customer.email || "",
        phone: customer.phone || "",
        tags: customer.tags || [],
      },
      retentionState: derivedState,
      cadenceDays,
      cadenceSource: observedCadence ? "observed_visit_median" : "phase11_default_56_days",
      lastVisit,
      daysSinceLastVisit,
      dueAt,
      nextAppointment,
      recentVisitCount: recentVisits.length,
      lifetimeVisits: Number(customer.completedAppointmentCount ?? customer.visitCount ?? 0),
      totalSpent: Number(customer.totalSpent || 0),
      latestLocationId: idText(recentVisits[0].location),
      executionAuthorised: false,
    });
  }

  const priority = { dormant: 0, overdue: 1, due: 2, approaching_due: 3, healthy: 4, booked: 5, no_visit_history: 6 };
  queue.sort((a, b) => {
    const rank = (priority[a.retentionState] ?? 99) - (priority[b.retentionState] ?? 99);
    if (rank !== 0) return rank;
    return Number(b.daysSinceLastVisit || 0) - Number(a.daysSinceLastVisit || 0);
  });

  return {
    queue: queue.slice(0, safeLimit),
    count: Math.min(queue.length, safeLimit),
    totalMatched: queue.length,
    authority: {
      businessId: scope.businessId,
      scopeMode: scope.scopeMode,
      locationIds: scope.allowedLocationIds,
    },
    generatedAt: now.toISOString(),
    deterministic: true,
    executionAuthorised: false,
  };
}
