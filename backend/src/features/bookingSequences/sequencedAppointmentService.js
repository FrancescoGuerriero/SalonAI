import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import {
  createManagedAppointment,
  getManagedAppointment,
} from "../appointments/appointmentManagementService.js";
import {
  buildSequenceAvailableSlots,
} from "./serviceSequenceFeasibility.js";
import {
  buildSequenceReservationPlan,
} from "./sequenceReservationPlan.js";
import BookingResource from "./BookingResource.js";
import BookingResourceReservation from "./BookingResourceReservation.js";
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

function minuteOfDay(time) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(time || "").trim());
  if (!match) {
    throw serviceError(
      "appointmentTime must use HH:mm format.",
      "INVALID_SEQUENCE_BOOKING_TIME",
      400,
      { field: "appointmentTime" }
    );
  }
  return Number(match[1]) * 60 + Number(match[2]);
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
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({
          kind: requirement.kind,
          key: String(requirement.resourceKey || "").trim().toLowerCase(),
        });
      }
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

  if (sequence.business) {
    match.business = sequence.business;
  }

  return BookingResource.find(match).session(session).lean();
}

async function busyReservations(resourceIds, startsAt, endsAt, session) {
  if (resourceIds.length === 0) return [];

  const reservations = await BookingResourceReservation.find({
    resource: { $in: resourceIds },
    startsAt: { $lt: endsAt },
    endsAt: { $gt: startsAt },
  })
    .session(session)
    .lean();

  if (reservations.length === 0) return [];

  const appointmentIds = [...new Set(reservations.map((item) => String(item.appointment)))];
  const activeAppointments = await Appointment.find({
    _id: { $in: appointmentIds },
    status: { $nin: ["cancelled", "no_show"] },
  })
    .select("_id")
    .session(session)
    .lean();

  const activeIds = new Set(activeAppointments.map((item) => String(item._id)));
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

export async function createSequencedManagedAppointment(
  payload = {},
  {
    actor = null,
    bookingSource = "management",
    externalBookingReference = "",
  } = {}
) {
  const sequenceId = objectId(payload.serviceSequence, "serviceSequence");
  const serviceId = objectId(payload.service, "service");
  const locationId = objectId(payload.location, "location", { required: false });

  const databaseSession = await mongoose.startSession();
  let appointmentId = null;
  let sequenceSummary = null;
  let reservationSummary = [];

  try {
    await databaseSession.withTransaction(async () => {
      const sequence = await ServiceSequence.findOne({
        _id: sequenceId,
        active: true,
      })
        .session(databaseSession)
        .lean();

      if (!sequence) {
        throw serviceError(
          "The selected service sequence is not available.",
          "SERVICE_SEQUENCE_NOT_FOUND",
          404,
          { field: "serviceSequence" }
        );
      }

      if (String(sequence.primaryService) !== String(serviceId)) {
        throw serviceError(
          "The selected service sequence does not belong to the requested service.",
          "SERVICE_SEQUENCE_SERVICE_MISMATCH",
          409,
          { field: "serviceSequence" }
        );
      }

      if (
        payload.business &&
        sequence.business &&
        String(payload.business) !== String(sequence.business)
      ) {
        throw serviceError(
          "The selected service sequence belongs to a different business.",
          "SERVICE_SEQUENCE_BUSINESS_MISMATCH",
          409,
          { field: "serviceSequence" }
        );
      }

      const when = sequenceDateAndTime(payload);
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

      const existingReservations = await busyReservations(
        resources.map((resource) => resource._id),
        plan.startsAt,
        plan.endsAt,
        databaseSession
      );

      const availableStarts = buildSequenceAvailableSlots({
        date: plan.dateKey,
        ranges: [{ start: plan.startTime, end: plan.endTime }],
        sequence,
        resources: availabilityMap(resources, existingReservations),
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

      const appointment = await createManagedAppointment(
        {
          ...payload,
          duration: plan.totalDurationMinutes,
          endsAt: plan.endsAt,
        },
        {
          actor,
          session: databaseSession,
          bookingSource,
          externalBookingReference:
            externalBookingReference || payload.externalBookingReference || "",
          returnPopulated: false,
        }
      );

      appointmentId = appointment._id;

      if (plan.reservations.length > 0) {
        const resourcesByKey = new Map(
          resources.map((resource) => [resourceKey(resource.kind, resource.key), resource])
        );

        const reservationDocuments = plan.reservations.map((reservation) => {
          const resource = resourcesByKey.get(
            resourceKey(reservation.kind, resourceKey)
          );
          return {
            business: sequence.business || undefined,
            location: locationId,
            appointment: appointment._id,
            serviceSequence: sequence._id,
            resource: resource._id,
            kind: reservation.kind,
            resourceKey: resourceKey,
            segmentOrder: resourcd.segmentOrder,
            segmentType: resourcd.segmentType,
            startsAt: reservation.startsAt,
            endsAt: reservation.endsAt,
            quantity: reservation.quantity,
          };
        });

        const created = await BookingResourceReservation.create(
          reservationDocuments,
          { session: databaseSession }
        );
        reservationSummary = created.map((reservation) => ({
          id: String(reservation._id),
          resource: String(reservation.resource),
          kind: reservation.kind,
          resourceKey: reservation.resourceKey,
          startsAt: reservation.startsAt,
          endsAt: reservation.endsAt,
          quantity: reservation.quantity,
        }));
      }

      sequenceSummary = {
        id: String(sequence._id),
        name: sequence.name,
        totalDurationMinutes: plan.totalDurationMinutes,
        startsAt: plan.startsAt,
        endsAt: plan.endsAt,
      };
    });
  } finally {
    await databaseSession.endSession();
  }

  if (!appointmentId) {
    throw serviceError(
      "The sequence appointment could not be created.",
      "SEQUENCE_BOOKING_NOT_CREATED",
      500
    );
  }

  return {
    appointment: await getManagedAppointment(appointmentId),
    serviceSequence: sequenceSummary,
    resourceReservations: reservationSummary,
  };
}

export default {
  createSequencedManagedAppointment,
};
