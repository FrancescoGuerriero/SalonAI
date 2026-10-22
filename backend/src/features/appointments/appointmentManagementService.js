import mongoose from "mongoose";

import Appointment, {
  APPOINTMENT_STATUSES,
} from "../../models/Appointment.js";
import Customer from "../../models/customer.js";
import Service from "../../models/service.js";
import Stylist from "../../models/Stylist.js";
import ProviderOccupancyReservation from "../bookingSequences/ProviderOccupancyReservation.js";
import {
  assertAppointmentWithinStaffAvailability,
} from "../staff/staffService.js";
import {
  appointmentEligibleStylistFilter,
} from "../../services/stylistBookingEligibilityService.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import {
  formatSalonTime,
  salonDateAnchor,
  salonDayBounds,
} from "../../shared/salonTime.js";
import * as core from "./appointmentManagementCore.js";

const APPOINTMENT_POPULATE_OPTIONS = core.APPOINTMENT_POPULATE_OPTIONS;
const CALENDAR_APPOINTMENT_FIELDS = core.CALENDAR_APPOINTMENT_FIELDS;
const CALENDAR_POPULATE_OPTIONS = core.CALENDAR_POPULATE_OPTIONS;
const SUPPORTED_CHANNELS = core.SUPPORTED_CHANNELS;
const TERMINAL_STATUSES = core.TERMINAL_STATUSES;
const appointmentWindow = core.appointmentWindow;
const bulkChangeAppointmentStatus = core.bulkChangeAppointmentStatus;
const calendarAppointments = core.calendarAppointments;
const changeAppointmentStatus = core.changeAppointmentStatus;
const combineDateAndTime = core.combineDateAndTime;
const getAppointmentManagementSummary = core.getAppointmentManagementSummary;
const getManagedAppointment = core.getManagedAppointment;
const listAppointmentStylists = core.listAppointmentStylists;
const queueAppointmentReminder = core.queueAppointmentReminder;
const queueUpcomingReminders = core.queueUpcomingReminders;
const searchAppointmentCustomers = core.searchAppointmentCustomers;

function normaliseText(value) {
  return String(value ?? "").trim();
}

function normaliseLowercase(value) {
  return normaliseText(value).toLowerCase();
}

function normaliseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalised = normaliseLowercase(value);
  if (["true", "1", "yes", "on", "enabled"].includes(normalised)) return true;
  if (["false", "0", "no", "off", "disabled"].includes(normalised)) return false;
  return fallback;
}

function assertValidObjectId(value, fieldName) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(
      `${fieldName} must be a valid identifier.`,
      400,
      { field: fieldName }
    );
  }
  return value;
}

function getActorId(actor) {
  const actorId = actor?._id || actor?.id || actor || null;
  return mongoose.isValidObjectId(actorId) ? actorId : null;
}

function parseDate(value, fieldName) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createServiceError(
      `${fieldName} must be a valid date.`,
      400,
      { field: fieldName }
    );
  }
  return date;
}

function getAppointmentStart(appointment) {
  if (appointment?.startsAt) {
    const start = new Date(appointment.startsAt);
    if (!Number.isNaN(start.getTime())) return start;
  }
  return combineDateAndTime(
    appointment?.appointmentDate,
    appointment?.appointmentTime
  );
}

function getAppointmentEnd(appointment) {
  if (appointment?.endsAt) {
    const end = new Date(appointment.endsAt);
    if (!Number.isNaN(end.getTime())) return end;
  }
  const start = getAppointmentStart(appointment);
  const duration = Math.max(1, Math.min(1440, Math.round(Number(appointment?.duration) || 60)));
  return new Date(start.getTime() + duration * 60000);
}

function normaliseProviderWindows(payload, fallbackWindow) {
  const supplied = Object.prototype.hasOwnProperty.call(
    payload && typeof payload === "object" ? payload : {},
    "providerWindows"
  );

  if (!supplied) {
    return [
      {
        start: fallbackWindow.start,
        end: fallbackWindow.end,
      },
    ];
  }

  if (!Array.isArray(payload.providerWindows)) {
    throw createServiceError(
      "providerWindows must be an array.",
      400,
      { field: "providerWindows" }
    );
  }

  const windows = payload.providerWindows
    .map((entry, index) => {
      const start = parseDate(entry?.startsAt ?? entry?.start, `providerWindows[${index}].startsAt`);
      const end = parseDate(entry?.endsAt ?? entry?.end, `providerWindows[${index}].endsAt`);

      if (end <= start) {
        throw createServiceError(
          "Provider occupancy end must be after its start.",
          400,
          { field: `providerWindows[${index}].endsAt` }
        );
      }

      if (start < fallbackWindow.start || end > fallbackWindow.end) {
        throw createServiceError(
          "Provider occupancy must stay inside the appointment window.",
          400,
          { field: `providerWindows[${index}]` }
        );
      }

      return { start, end };
    })
    .sort((left, right) => left.start - right.start);

  const merged = [];
  for (const current of windows) {
    const previous = merged[merged.length - 1];
    if (previous && current.start <= previous.end) {
      if (current.end > previous.end) previous.end = current.end;
      continue;
    }
    merged.push({ ...current });
  }

  return merged;
}

async function providerReservationsForAppointments(appointmentIds, session = null) {
  if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) return [];

  let query = ProviderOccupancyReservation.find({
    appointment: { $in: appointmentIds },
  }).select("appointment startsAt endsAt segmentOrder");

  if (session) {
    query = query.session(session);
  }

  return query.lean();
}

/*
|--------------------------------------------------------------------------
| Conflict detection
|--------------------------------------------------------------------------
*/

async function findConflict({
  stylist,
  start,
  end,
  excludeAppointmentId = null,
  session = null,
}) {
  assertValidObjectId(stylist, "stylist");

  const startDate = parseDate(start, "start");
  const endDate = parseDate(end, "end");

  if (endDate <= startDate) {
    throw createServiceError(
      "Conflict-check end time must be after the start time.",
      400
    );
  }

  const {
    start: conflictDayStart,
    end: conflictDayEnd,
  } = salonDayBounds(startDate);

  const match = {
    stylist,
    status: {
      $nin: ["cancelled", "no_show"],
    },
    $or: [
      {
        startsAt: { $lt: endDate },
        endsAt: { $gt: startDate },
      },
      {
        appointmentDate: {
          $gte: conflictDayStart,
          $lte: conflictDayEnd,
        },
      },
    ],
  };

  if (excludeAppointmentId) {
    assertValidObjectId(excludeAppointmentId, "excludeAppointmentId");
    match._id = { $ne: excludeAppointmentId };
  }

  let candidateQuery = Appointment.find(match)
    .select(
      "customer stylist service appointmentDate appointmentTime startsAt endsAt duration status"
    )
    .populate("customer", "firstName lastName fullName name")
    .populate("service", "name duration");

  if (session) {
    candidateQuery = candidateQuery.session(session);
  }

  const candidates = await candidateQuery.lean();
  if (candidates.length === 0) return null;

  const providerReservations = await providerReservationsForAppointments(
    candidates.map((appointment) => appointment._id),
    session
  );
  const providerByAppointment = new Map();

  for (const reservation of providerReservations) {
    const key = String(reservation.appointment);
    const entries = providerByAppointment.get(key) || [];
    entries.push({
      start: new Date(reservation.startsAt),
      end: new Date(reservation.endsAt),
    });
    providerByAppointment.set(key, entries);
  }

  return (
    candidates.find((appointment) => {
      const providerWindows = providerByAppointment.get(String(appointment._id));

      if (providerWindows?.length) {
        return providerWindows.some(
          (window) => window.start < endDate && window.end > startDate
        );
      }

      const candidateStart = getAppointmentStart(appointment);
      const candidateEnd = getAppointmentEnd(appointment);
      return candidateStart < endDate && candidateEnd > startDate;
    }) || null
  );
}

function serviceIsGloballyBookable(service) {
  if (!service) return false;
  return typeof service.bookable === "boolean"
    ? service.bookable
    : service.onlineBookable !== false;
}

async function appointmentEligibleService(
  serviceId,
  {
    session = null,
  } = {}
) {
  assertValidObjectId(serviceId, "service");

  let serviceQuery = Service.findById(serviceId).select("+onlineBookable");
  if (session) serviceQuery = serviceQuery.session(session);

  const service = assertFound(
    await serviceQuery.lean(),
    "Service not found."
  );

  if (service.active === false) {
    throw createServiceError(
      "The selected service is inactive.",
      409,
      { field: "service" }
    );
  }

  if (!serviceIsGloballyBookable(service)) {
    throw createServiceError(
      "The selected service is not available for booking.",
      409,
      { field: "service" }
    );
  }

  return service;
}

async function appointmentEligibleStylist(
  stylistId,
  {
    session = null,
  } = {}
) {
  assertValidObjectId(stylistId, "stylist");

  let stylistQuery = Stylist.findById(stylistId).where(
    appointmentEligibleStylistFilter()
  );
  if (session) stylistQuery = stylistQuery.session(session);

  const stylist = await stylistQuery;
  if (!stylist) {
    throw createServiceError(
      "The selected stylist is not currently bookable.",
      409,
      { field: "stylist" }
    );
  }
  return stylist;
}

async function checkAppointmentConflict(payload = {}) {
  const stylist = payload.stylist;
  assertValidObjectId(stylist, "stylist");

  let service = null;
  if (payload.service) {
    assertValidObjectId(payload.service, "service");
    service = await appointmentEligibleService(payload.service);
  }

  await appointmentEligibleStylist(stylist);

  const window = appointmentWindow(payload, service);
  const providerWindows = normaliseProviderWindows(payload, window);
  let conflict = null;

  for (const providerWindow of providerWindows) {
    conflict = await findConflict({
      stylist,
      start: providerWindow.start,
      end: providerWindow.end,
      excludeAppointmentId: payload.excludeAppointmentId || null,
    });
    if (conflict) break;
  }

  return {
    hasConflict: Boolean(conflict),
    conflict,
    requestedWindow: {
      stylist,
      startsAt: window.start,
      endsAt: window.end,
      duration: window.duration,
      providerWindows,
    },
  };
}

/*
|--------------------------------------------------------------------------
| Staff-managed appointment creation
|--------------------------------------------------------------------------
*/

async function createManagedAppointment(
  payload = {},
  {
    actor = null,
    session = null,
    bookingSource =
      "management",
    externalBookingReference =
      "",
    returnPopulated =
      true,
  } = {}
) {
  const customerId = assertValidObjectId(payload.customer, "customer");
  const stylistId = assertValidObjectId(payload.stylist, "stylist");
  const serviceId = assertValidObjectId(payload.service, "service");

  let customerQuery = Customer.findById(customerId);
  if (session) {
    customerQuery = customerQuery.session(session);
  }

  let customer;
  let service;

  if (session) {
    customer = await customerQuery;
    service = await appointmentEligibleService(
      serviceId,
      {
        session,
      }
    );
  } else {
    [customer, service] = await Promise.all([
      customerQuery,
      appointmentEligibleService(serviceId),
    ]);
  }

  assertFound(customer, "Customer not found.");

  await appointmentEligibleStylist(
    stylistId,
    {
      session,
    }
  );

  const window = appointmentWindow(payload, service);
  const providerWindows = normaliseProviderWindows(payload, window);

  for (const providerWindow of providerWindows) {
    await assertAppointmentWithinStaffAvailability(
      stylistId,
      providerWindow.start,
      providerWindow.end
    );

    const conflict = await findConflict({
      stylist: stylistId,
      start: providerWindow.start,
      end: providerWindow.end,
      session,
    });

    if (conflict) {
      throw createServiceError(
        "The stylist already has an overlapping appointment.",
        409,
        { conflict }
      );
    }
  }

  const actorId = getActorId(actor);
  const status = payload.status
    ? (() => {
        const normalisedStatus = normaliseLowercase(payload.status).replaceAll("-", "_");
        if (!APPOINTMENT_STATUSES.includes(normalisedStatus)) {
          throw createServiceError(
            `Status must be one of: ${APPOINTMENT_STATUSES.join(", ")}.`,
            400,
            { field: "status" }
          );
        }
        return normalisedStatus;
      })()
    : "pending";

  const appointmentPayload = {
    business: payload.business || undefined,
    location: payload.location || undefined,
    customer: customerId,
    stylist: stylistId,
    service: serviceId,
    appointmentDate: salonDateAnchor(window.start),
    appointmentTime: formatSalonTime(window.start),
    startsAt: window.start,
    endsAt: window.end,
    duration: window.duration,
    totalPrice: Math.max(
      0,
      Number(payload.totalPrice ?? service.price ?? 0) || 0
    ),
    discount: Math.max(0, Number(payload.discount) || 0),
    tax: Math.max(0, Number(payload.tax) || 0),
    status,
    notes: normaliseText(payload.notes),
    internalNotes: normaliseText(payload.internalNotes),
    bookingSource:
      normaliseText(bookingSource) ||
      "management",
    ...(
      normaliseText(externalBookingReference)
        ? {
            externalBookingReference:
              normaliseText(externalBookingReference),
          }
        : {}
    ),
    createdBy: actorId,
    updatedBy: actorId,
  };

  let appointment;

  if (session) {
    [appointment] = await Appointment.create(
      [appointmentPayload],
      {
        session,
      }
    );
  } else {
    appointment = await Appointment.create(appointmentPayload);
  }

  if (
    !customer.nextAppointment ||
    window.start < new Date(customer.nextAppointment)
  ) {
    customer.nextAppointment = window.start;
    customer.updatedBy = actorId;
    await customer.save(
      session
        ? {
            session,
          }
        : undefined
    );
  }

  if (returnPopulated === false) {
    return appointment;
  }

  return getManagedAppointment(appointment._id);
}

/*
|--------------------------------------------------------------------------
| Calendar and appointment retrieval
|--------------------------------------------------------------------------
*/

/*
 * All retrieval, reporting, status, reminder and bulk operations remain in
 * the established core. Only booking-window authority is overridden here so
 * processing gaps can release providers without forking Appointment state.
 */

async function rescheduleAppointment(
  appointmentId,
  payload = {},
  {
    actor = null,
  } = {}
) {
  assertValidObjectId(appointmentId, "appointmentId");

  const appointment = assertFound(
    await Appointment.findById(appointmentId).select("+internalNotes"),
    "Appointment not found."
  );

  if (await ProviderOccupancyReservation.exists({ appointment: appointment._id })) {
    throw createServiceError(
      "Sequenced appointments must be rescheduled through the sequence booking workflow.",
      409,
      { code: "SEQUENCE_RESCHEDULE_REQUIRED" }
    );
  }

  if (
    TERMINAL_STATUSES.includes(appointment.status) &&
    !normaliseBoolean(payload.force, false)
  ) {
    throw createServiceError(
      `A ${appointment.status} appointment cannot be rescheduled without force=true.`,
      409,
      { status: appointment.status }
    );
  }

  const serviceId = payload.service || appointment.service;
  assertValidObjectId(serviceId, "service");
  const service = await appointmentEligibleService(serviceId);

  const windowPayload = {
    ...appointment.toObject(),
    ...payload,
    service: serviceId,
  };

  if (
    !payload.startsAt &&
    (payload.appointmentDate || payload.appointmentTime)
  ) {
    windowPayload.startsAt = null;
    if (!payload.endsAt) windowPayload.endsAt = null;
  }

  const window = appointmentWindow(windowPayload, service);
  const stylist = payload.stylist || appointment.stylist;
  assertValidObjectId(stylist, "stylist");
  await appointmentEligibleStylist(stylist);

  const providerWindows = normaliseProviderWindows(payload, window);
  for (const providerWindow of providerWindows) {
    await assertAppointmentWithinStaffAvailability(
      stylist,
      providerWindow.start,
      providerWindow.end
    );

    const conflict = await findConflict({
      stylist,
      start: providerWindow.start,
      end: providerWindow.end,
      excludeAppointmentId: appointment._id,
    });

    if (conflict) {
      throw createServiceError(
        "The stylist already has an overlapping appointment.",
        409,
        { conflict }
      );
    }
  }

  const changedBy =
    getActorId(actor) ||
    getActorId(payload.changedBy) ||
    getActorId(payload.updatedBy);
  const reason = normaliseText(payload.reason);

  if (typeof appointment.recordReschedule === "function") {
    appointment.recordReschedule({
      stylist,
      startsAt: window.start,
      endsAt: window.end,
      reason,
      changedBy,
    });
  } else {
    appointment.stylist = stylist;
    appointment.startsAt = window.start;
    appointment.endsAt = window.end;
    appointment.appointmentDate = salonDateAnchor(window.start);
    appointment.appointmentTime = formatSalonTime(window.start);
    appointment.duration = window.duration;
    appointment.rescheduledAt = new Date();
    appointment.rescheduleCount = Number(appointment.rescheduleCount) + 1;
  }

  appointment.service = serviceId;
  appointment.duration = window.duration;
  appointment.updatedBy = changedBy;
  appointment.reminderSent = false;
  appointment.reminderSentAt = null;

  await appointment.save();
  return getManagedAppointment(appointment._id);
}

export {
  APPOINTMENT_POPULATE_OPTIONS,
  CALENDAR_APPOINTMENT_FIELDS,
  CALENDAR_POPULATE_OPTIONS,
  SUPPORTED_CHANNELS,
  TERMINAL_STATUSES,
  appointmentWindow,
  bulkChangeAppointmentStatus,
  createManagedAppointment,
  calendarAppointments,
  changeAppointmentStatus,
  checkAppointmentConflict,
  combineDateAndTime,
  findConflict,
  getAppointmentManagementSummary,
  getManagedAppointment,
  listAppointmentStylists,
  normaliseProviderWindows,
  queueAppointmentReminder,
  queueUpcomingReminders,
  rescheduleAppointment,
  searchAppointmentCustomers,
};

export default {
  bulkChangeAppointmentStatus,
  createManagedAppointment,
  calendarAppointments,
  changeAppointmentStatus,
  checkAppointmentConflict,
  findConflict,
  getAppointmentManagementSummary,
  getManagedAppointment,
  listAppointmentStylists,
  queueAppointmentReminder,
  queueUpcomingReminders,
  rescheduleAppointment,
  searchAppointmentCustomers,
};
