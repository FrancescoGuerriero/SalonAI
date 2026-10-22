import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import {
  findConflict,
  getManagedAppointment,
  TERMINAL_STATUSES,
} from "../appointments/appointmentManagementService.js";
import {
  assertAppointmentWithinStaffAvailability,
} from "../staff/staffService.js";
import {
  buildSequenceAvailableSlots,
} from "./serviceSequenceFeasibility.js";
import {
  buildSequenceReservationPlan,
} from "./sequenceReservationPlan.js";
import BookingResource from "./BookingResource.js";
import BookingResourceReservation from "./BookingResourceReservation.js";
import ProviderOccupancyReservation from "./ProviderOccupancyReservation.js";
import ServiceSequence from "./ServiceSequence.js";
import {
  formatSalonTime,
  toSalonDateKey,
} from "../../shared/salonTime.js";

function serviceError(message, code, statusCode = 400, details = undefined) {
  const error = new Error(message);
  error.code = code;
  error.status = statusCode;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function objectId(value, field, { required = true } = {}) {
  if ((value === undefined || value === null || value === "") && !required) {
    return null;
  }
  if (!mongoose.isValidObjectId(value)) {
    throw serviceError(
      `${field} must be a valid identifier.`,
      "INVALID_SEQUENCE_BOOKING_IDENTIFIER",
      400,
      { field }
    );
  }
  return value;
}

function resourceKey(kind, key) {
  return `${String(kind || "").trim()}:${String(key || "").trim().toLowerCase()}`;
}

function sequenceDateAndTime(payload = {}) {
  if (payload.startsAt) {
    const startsAt = new Date(payload.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw serviceError(
        "startsAt must be a valid date.",
        "INVALID_SEQUENCE_BOOKING_DATE",
        400,
        { field: "startsAt" }
      );
    }
    return {
      date: toSalonDateKey(startsAt, { field: "startsAt" }),
      time: formatSalonTime(startsAt),
    };
  }

  return {
    date: toSalonDateKey(payload.appointmentDate, { field: "appointmentDate" }),
    time: String(payload.appointmentTime || "").trim(),
  };
}

function requiredResourcePairs(sequence) {
  const pairs = [];
  const seen = new Set();

  for (const step of sequence?.steps || []) {
    for (const requirement of step?.resourceRequirements || []) {
      const key = resourceKey(requirement.kind, requirement.resourceKey);
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({
        kind: requirement.kind,
        key: String(requirement.resourceKey || "").trim().toLowerCase(),
      });
    }
  }

  return pairs;
}

async function activeResourcesForSequence(sequence, locationId, session) {
  const pairs = requiredResourcePairs(sequence);
  if (pairs.length === 0) return [];

  if (!locationId) {
    throw serviceError(
      "location is required when a service sequence uses rooms, chairs or equipment.",
      "SEQUENCE_LOCATION_REQUIRED",
      400,
      { field: "location" }
    );
  }

  const match = {
    location: locationId,
    active: true,
    $or: pairs,
  };
  if (sequence.business) match.business = sequence.business;

  return BookingResource.find(match).session(session).lean();
}

async function busyReservations(
  resourceIds,
  startsAt,
  endsAt,
  session,
  excludeAppointmentId
) {
  if (resourceIds.length === 0) return [];

  const reservations = await BookingResourceReservation.find({
    resource: { $in: resourceIds },
    appointment: { $ne: excludeAppointmentId },
    startsAt: { $lt: endsAt },
    endsAt: { $gt: startsAt },
  })
    .session(session)
    .lean();

  if (reservations.length === 0) return [];

  const appointmentIds = [
    ...new Set(reservations.map((item) => String(item.appointment))),
  ];
  const activeAppointments = await Appointment.find({
    _id: { $in: appointmentIds },
    status: { $nin: ["cancelled", "no_show"] },
  })
    .select("_id")
    .session(session)
    .lean();

  const activeIds = new Set(
    activeAppointments.map((item) => String(item._id))
  );
  return reservations.filter((item) => activeIds.has(String(item.appointment)));
}

function availabilityMap(resources, reservations) {
  const busyByResource = new Map();

  for (const reservation of reservations) {
    const key = String(reservation.resource);
    const list = busyByResource.get(key) || [];
    list.push({
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
      quantity: reservation.quantity,
    });
    busyByResource.set(key, list);
  }

  return Object.fromEntries(
    resources.map((resource) => [
      resourceKey(resource.kind, resource.key),
      {
        capacity: resource.capacity,
        busy: busyByResource.get(String(resource._id)) || [],
      },
    ])
  );
}

async function assertProviderWindowsAvailable(
  stylistId,
  providerWindows,
  session,
  appointmentId
) {
  for (const window of providerWindows) {
    await assertAppointmentWithinStaffAvailability(
      stylistId,
      window.startsAt,
      window.endsAt
    );

    const conflict = await findConflict({
      stylist: stylistId,
      start: window.startsAt,
      end: window.endsAt,
      excludeAppointmentId: appointmentId,
      session,
    });

    if (conflict) {
      throw serviceError(
        "The stylist already has an overlapping appointment during a provider-required sequence segment.",
        "SERVICE_SEQUENCE_PROVIDER_CONFLICT",
        409,
        { conflict }
      );
    }
  }
}

function providerDocuments({ plan, sequence, appointment, stylistId, locationId }) {
  return plan.providerWindows.map((window) => ({
    business: sequence.business || undefined,
    location: locationId || undefined,
    appointment: appointment._id,
    serviceSequence: sequence._id,
    stylist: stylistId,
    segmentOrder: window.segmentOrder,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
  }));
}

function resourceDocuments({ plan, sequence, appointment, resources, locationId }) {
  const resourcesByKey = new Map(
    resources.map((resource) => [
      resourceKey(resource.kind, resource.key),
      resource,
    ])
  );

  return plan.reservations.map((reservation) => {
    const compoundKey = resourceKey(
      reservation.kind,
      reservation.resourceKey
    );
    const resource = resourcesByKey.get(compoundKey);

    if (!resource) {
      throw serviceError(
        `Required booking resource ${compoundKey} disappeared during rescheduling.`,
        "BOOKING_RESOURCE_NOT_FOUND",
        409,
        { field: "serviceSequence" }
      );
    }

    return {
      business: sequence.business || undefined,
      location: locationId,
      appointment: appointment._id,
      serviceSequence: sequence._id,
      resource: resource._id,
      kind: reservation.kind,
      resourceKey: reservation.resourceKey,
      segmentOrder: reservation.segmentOrder,
      segmentType: reservation.segmentType,
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
      quantity: reservation.quantity,
    };
  });
}

function reservationSummary(items) {
  return items.map((item) => ({
    id: String(item._id),
    resource: item.resource ? String(item.resource) : undefined,
    stylist: item.stylist ? String(item.stylist) : undefined,
    kind: item.kind,
    resourceKey: item.resourceKey,
    segmentOrder: item.segmentOrder,
    segmentType: item.segmentType,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    quantity: item.quantity,
  }));
}

export async function rescheduleSequencedManagedAppointment(
  appointmentId,
  payload = {},
  { actor = null } = {}
) {
  objectId(appointmentId, "appointmentId");

  const databaseSession = await mongoose.startSession();
  let appointmentResult = null;
  let sequenceSummary = null;
  let providerReservations = [];
  let resourceReservations = [];

  try {
    await databaseSession.withTransaction(async () => {
      const appointment = await Appointment.findById(appointmentId)
        .select("+internalNotes")
        .session(databaseSession);

      if (!appointment) {
        throw serviceError(
          "Appointment not found.",
          "SEQUENCE_APPOINTMENT_NOT_FOUND",
          404
        );
      }

      const existingProvider = await ProviderOccupancyReservation.findOne({
        appointment: appointment._id,
      })
        .session(databaseSession)
        .lean();

      if (!existingProvider) {
        throw serviceError(
          "The appointment is not managed by a service sequence.",
          "SEQUENCE_RESERVATION_NOT_FOUND",
          409
        );
      }

      if (
        TERMINAL_STATUSES.includes(appointment.status) &&
        payload.force !== true
      ) {
        throw serviceError(
          `A ${appointment.status} sequenced appointment cannot be rescheduled without force=true.`,
          "SEQUENCE_TERMINAL_RESCHEDULE_BLOCKED",
          409
        );
      }

      const sequence = await ServiceSequence.findOne({
        _id: existingProvider.serviceSequence,
        active: true,
      })
        .session(databaseSession)
        .lean();

      if (!sequence) {
        throw serviceError(
          "The service sequence is no longer available for rescheduling.",
          "SERVICE_SEQUENCE_NOT_FOUND",
          409
        );
      }

      if (String(sequence.primaryService) !== String(appointment.service)) {
        throw serviceError(
          "The appointment service no longer matches its service sequence.",
          "SERVICE_SEQUENCE_SERVICE_MISMATCH",
          409
        );
      }

      const stylistId = objectId(
        payload.stylist || appointment.stylist,
        "stylist"
      );
      const locationId = objectId(
        payload.location || appointment.location,
        "location",
        { required: false }
      );

      const hasNewClock = Boolean(
        payload.startsAt ||
        payload.appointmentDate ||
        payload.appointmentTime
      );
      const when = sequenceDateAndTime(
        hasNewClock
          ? {
              appointmentDate:
                payload.appointmentDate || appointment.appointmentDate,
              appointmentTime:
                payload.appointmentTime || appointment.appointmentTime,
              ...(payload.startsAt ? { startsAt: payload.startsAt } : {}),
            }
          : { startsAt: appointment.startsAt }
      );

      const resources = await activeResourcesForSequence(
        sequence,
        locationId,
        databaseSession
      );
      const plan = buildSequenceReservationPlan({
        sequence,
        date: when.date,
        startTime: when.time,
        resources,
      });

      const busy = await busyReservations(
        resources.map((resource) => resource._id),
        plan.startsAt,
        plan.endsAt,
        databaseSession,
        appointment._id
      );
      const availableStarts = buildSequenceAvailableSlots({
        date: plan.dateKey,
        ranges: [{ start: plan.startTime, end: plan.endTime }],
        sequence,
        resources: availabilityMap(resources, busy),
        interval: 30,
        now: new Date(),
      });

      if (!availableStarts.includes(plan.startTime)) {
        throw serviceError(
          "The requested sequence time no longer has the required booking resources.",
          "SERVICE_SEQUENCE_RESOURCE_CONFLICT",
          409,
          { field: "appointmentTime" }
        );
      }

      await assertProviderWindowsAvailable(
        stylistId,
        plan.providerWindows,
        databaseSession,
        appointment._id
      );

      const changedByCandidate = actor?._id || actor?.id || actor || null;
      const changedBy = mongoose.isValidObjectId(changedByCandidate)
        ? changedByCandidate
        : null;
      const reason = String(payload.reason ?? "").trim();

      if (typeof appointment.recordReschedule !== "function") {
        throw serviceError(
          "Canonical appointment rescheduling support is unavailable.",
          "SEQUENCE_CANONICAL_RESCHEDULE_UNAVAILABLE",
          500
        );
      }

      appointment.recordReschedule({
        stylist: stylistId,
        startsAt: plan.startsAt,
        endsAt: plan.endsAt,
        reason,
        changedBy,
      });
      appointment.location = locationId || undefined;
      appointment.duration = plan.totalDurationMinutes;
      appointment.updatedBy = changedBy;
      appointment.reminderSent = false;
      appointment.reminderSentAt = null;
      await appointment.save({ session: databaseSession });

      await Promise.all([
        ProviderOccupancyReservation.deleteMany({
          appointment: appointment._id,
        }).session(databaseSession),
        BookingResourceReservation.deleteMany({
          appointment: appointment._id,
        }).session(databaseSession),
      ]);

      const createdProvider = await ProviderOccupancyReservation.create(
        providerDocuments({
          plan,
          sequence,
          appointment,
          stylistId,
          locationId,
        }),
        { session: databaseSession }
      );
      providerReservations = reservationSummary(createdProvider);

      if (plan.reservations.length > 0) {
        const createdResources = await BookingResourceReservation.create(
          resourceDocuments({
            plan,
            sequence,
            appointment,
            resources,
            locationId,
          }),
          { session: databaseSession }
        );
        resourceReservations = reservationSummary(createdResources);
      }

      sequenceSummary = {
        id: String(sequence._id),
        name: sequence.name,
        totalDurationMinutes: plan.totalDurationMinutes,
        startsAt: plan.startsAt,
        endsAt: plan.endsAt,
      };
      appointmentResult = appointment._id;
    });
  } finally {
    await databaseSession.endSession();
  }

  if (!appointmentResult) {
    throw serviceError(
      "The sequenced appointment could not be rescheduled.",
      "SEQUENCE_RESCHEDULE_NOT_COMPLETED",
      500
    );
  }

  return {
    appointment: await getManagedAppointment(appointmentResult),
    serviceSequence: sequenceSummary,
    providerReservations,
    resourceReservations,
  };
}

export default {
  rescheduleSequencedManagedAppointment,
};
