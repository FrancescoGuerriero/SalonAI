import mongoose from "mongoose";

import Customer from "../../models/customer.js";
import GroupBooking from "./GroupBooking.js";
import {
  changeAppointmentStatus,
  createManagedAppointment,
  rescheduleAppointment,
} from "../appointments/appointmentManagementService.js";
import {
  notifyAppointmentCancelled,
  notifyAppointmentConfirmed,
  notifyAppointmentRescheduled,
  notifySafely,
} from "../appointments/appointmentNotificationService.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

const MAX_GROUP_PARTICIPANTS = 25;

async function notifyCreatedAppointment(appointmentId, actor) {
  await notifySafely(
    () =>
      notifyAppointmentConfirmed(appointmentId, {
        actorId: actorId(actor),
      }),
    {
      event: "appointment.created",
      appointmentId: String(appointmentId),
      source: "group_booking",
    }
  );
}

async function notifyGroupStatusAppointment(appointment, status, actor) {
  const appointmentId = appointment?._id || appointment?.id || appointment;
  const options = { actorId: actorId(actor) };

  if (status === "cancelled") {
    return notifySafely(
      () => notifyAppointmentCancelled(appointmentId, options),
      {
        event: "appointment.cancelled",
        appointmentId: String(appointmentId),
        source: "group_booking",
      }
    );
  }

  if (status === "confirmed") {
    return notifySafely(
      () => notifyAppointmentConfirmed(appointmentId, options),
      {
        event: "appointment.confirmed",
        appointmentId: String(appointmentId),
        source: "group_booking",
      }
    );
  }

  return null;
}

function text(value) {
  return String(value ?? "").trim();
}

function actorId(actor) {
  const value = actor?._id || actor?.id || actor || null;
  return mongoose.isValidObjectId(value) ? value : null;
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, {
      field,
    });
  }

  return value;
}

function participantPayloads(value) {
  if (!Array.isArray(value)) {
    throw createServiceError("Group participants are required.", 400, {
      field: "participants",
    });
  }

  if (value.length < 2 || value.length > MAX_GROUP_PARTICIPANTS) {
    throw createServiceError(
      `A group booking must contain between 2 and ${MAX_GROUP_PARTICIPANTS} participants.`,
      400,
      { field: "participants" }
    );
  }

  return value;
}

async function customerExists(customerId, session = null) {
  let query = Customer.findById(customerId).select("_id status");
  if (session) query = query.session(session);

  const customer = await query.lean();

  if (!customer || customer.status === "deleted") {
    throw createServiceError("Customer not found.", 404, {
      field: "customer",
    });
  }

  return customer;
}

const GROUP_POPULATE = [
  {
    path: "organiser",
    select: "firstName lastName fullName preferredName name email phone status",
  },
  {
    path: "participants.appointment",
    select:
      "customer service stylist appointmentDate appointmentTime startsAt endsAt duration status bookingSource totalPrice finalPrice paymentStatus",
    populate: [
      {
        path: "service",
        select: "name category duration price active bookable published",
      },
      {
        path: "stylist",
        select:
          "name firstName lastName title jobTitle isActive acceptsAppointments profilePublished",
      },
      {
        path: "customer",
        select: "firstName lastName fullName preferredName name email phone status",
      },
    ],
  },
];

async function getGroupBooking(groupBookingId) {
  objectId(groupBookingId, "groupBookingId");

  return assertFound(
    await GroupBooking.findById(groupBookingId)
      .populate(GROUP_POPULATE)
      .lean(),
    "Group booking not found."
  );
}

export async function listGroupBookings({ organiser, limit = 100 } = {}) {
  const filter = {};

  if (organiser) {
    filter.organiser = objectId(organiser, "organiser");
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 250);

  return GroupBooking.find(filter)
    .populate(GROUP_POPULATE)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(safeLimit)
    .lean();
}

export async function createGroupBooking(payload = {}, { actor = null } = {}) {
  const organiser = objectId(payload.organiser, "organiser");
  const participants = participantPayloads(payload.participants);
  const session = await mongoose.startSession();
  let groupBookingId = null;
  const createdAppointmentIds = [];

  try {
    await session.withTransaction(async () => {
      await customerExists(organiser, session);

      const participantLinks = [];

      // Mongoose does not support parallel operations within one transaction.
      // Sequential creation also lets the shared conflict engine see earlier
      // appointments written by this same group transaction.
      for (const participant of participants) {
        const customer = objectId(participant.customer, "participant.customer");

        const appointment = await createManagedAppointment(
          {
            customer,
            stylist: participant.stylist,
            service: participant.service,
            startsAt: participant.startsAt,
            appointmentDate: participant.appointmentDate,
            appointmentTime: participant.appointmentTime,
            status: "pending",
            notes: text(participant.notes),
            internalNotes: text(participant.internalNotes),
          },
          {
            actor,
            session,
            bookingSource: "management",
            returnPopulated: false,
          }
        );

        participantLinks.push({
          appointment: appointment._id,
          label: text(participant.label),
        });
        createdAppointmentIds.push(appointment._id);
      }

      const [groupBooking] = await GroupBooking.create(
        [
          {
            organiser,
            title: text(payload.title) || "Group booking",
            notes: text(payload.notes),
            participants: participantLinks,
            createdBy: actorId(actor),
            updatedBy: actorId(actor),
          },
        ],
        { session }
      );

      groupBookingId = groupBooking._id;
    });
  } finally {
    await session.endSession();
  }

  for (const appointmentId of createdAppointmentIds) {
    await notifyCreatedAppointment(appointmentId, actor);
  }

  return getGroupBooking(groupBookingId);
}

export async function addGroupParticipant(
  groupBookingId,
  payload = {},
  { actor = null } = {}
) {
  objectId(groupBookingId, "groupBookingId");

  const session = await mongoose.startSession();
  let savedId = groupBookingId;
  let createdAppointmentId = null;

  try {
    await session.withTransaction(async () => {
      const group = assertFound(
        await GroupBooking.findById(groupBookingId).session(session),
        "Group booking not found."
      );

      if (group.participants.length >= MAX_GROUP_PARTICIPANTS) {
        throw createServiceError(
          `A group booking cannot contain more than ${MAX_GROUP_PARTICIPANTS} participants.`,
          409
        );
      }

      const customer = objectId(payload.customer, "participant.customer");

      const appointment = await createManagedAppointment(
        {
          customer,
          stylist: payload.stylist,
          service: payload.service,
          startsAt: payload.startsAt,
          appointmentDate: payload.appointmentDate,
          appointmentTime: payload.appointmentTime,
          status: "pending",
          notes: text(payload.notes),
          internalNotes: text(payload.internalNotes),
        },
        {
          actor,
          session,
          bookingSource: "management",
          returnPopulated: false,
        }
      );

      group.participants.push({
        appointment: appointment._id,
        label: text(payload.label),
      });
      createdAppointmentId = appointment._id;
      group.updatedBy = actorId(actor);
      await group.save({ session });
      savedId = group._id;
    });
  } finally {
    await session.endSession();
  }

  if (createdAppointmentId) {
    await notifyCreatedAppointment(createdAppointmentId, actor);
  }

  return getGroupBooking(savedId);
}

async function participantAppointment(groupBookingId, participantId) {
  objectId(groupBookingId, "groupBookingId");
  objectId(participantId, "participantId");

  const group = assertFound(
    await GroupBooking.findById(groupBookingId),
    "Group booking not found."
  );
  const participant = group.participants.id(participantId);

  if (!participant) {
    throw createServiceError("Group participant not found.", 404, {
      field: "participantId",
    });
  }

  return {
    group,
    participant,
    appointmentId: participant.appointment,
  };
}

export async function rescheduleGroupParticipant(
  groupBookingId,
  participantId,
  payload = {},
  { actor = null } = {}
) {
  const { group, appointmentId } = await participantAppointment(
    groupBookingId,
    participantId
  );

  const appointment = await rescheduleAppointment(
    appointmentId,
    payload,
    { actor }
  );

  await notifySafely(
    () =>
      notifyAppointmentRescheduled(appointmentId, {
        actorId: actorId(actor),
      }),
    {
      event: "appointment.rescheduled",
      appointmentId: String(appointmentId),
      source: "group_booking",
    }
  );

  group.updatedBy = actorId(actor);
  await group.save();

  return {
    groupBooking: await getGroupBooking(group._id),
    appointment,
  };
}

export async function changeGroupParticipantStatus(
  groupBookingId,
  participantId,
  payload = {},
  { actor = null } = {}
) {
  const { group, appointmentId } = await participantAppointment(
    groupBookingId,
    participantId
  );

  const status = text(payload.status);

  if (!status) {
    throw createServiceError("An appointment status is required.", 400, {
      field: "status",
    });
  }

  const appointment = await changeAppointmentStatus(
    appointmentId,
    status,
    {
      reason: text(payload.reason),
      requireReason:
        ["cancelled", "no_show"].includes(status) ||
        Boolean(payload.requireReason),
    },
    { actor }
  );

  await notifyGroupStatusAppointment(appointment, status, actor);

  group.updatedBy = actorId(actor);
  await group.save();

  return {
    groupBooking: await getGroupBooking(group._id),
    appointment,
  };
}

export async function changeGroupStatus(
  groupBookingId,
  payload = {},
  { actor = null } = {}
) {
  const group = assertFound(
    await GroupBooking.findById(objectId(groupBookingId, "groupBookingId")),
    "Group booking not found."
  );
  const status = text(payload.status);

  if (!status) {
    throw createServiceError("An appointment status is required.", 400, {
      field: "status",
    });
  }

  const results = [];

  // A group-wide change is intentionally partial-safe: each canonical
  // appointment reports its own result instead of silently rolling back
  // already completed participant changes.
  for (const participant of group.participants) {
    try {
      const appointment = await changeAppointmentStatus(
        participant.appointment,
        status,
        {
          reason: text(payload.reason),
          requireReason:
        ["cancelled", "no_show"].includes(status) ||
        Boolean(payload.requireReason),
        },
        { actor }
      );

      await notifyGroupStatusAppointment(appointment, status, actor);

      results.push({
        participantId: participant._id,
        appointmentId: participant.appointment,
        success: true,
        appointment,
      });
    } catch (error) {
      results.push({
        participantId: participant._id,
        appointmentId: participant.appointment,
        success: false,
        error: error.message,
        statusCode: error.statusCode || error.status || 500,
      });
    }
  }

  group.updatedBy = actorId(actor);
  await group.save();

  return {
    requested: results.length,
    updated: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results,
    groupBooking: await getGroupBooking(group._id),
  };
}

export { getGroupBooking };
