import mongoose from "mongoose";

import AbandonedBookingIntent from "../../models/AbandonedBookingIntent.js";
import Appointment from "../../models/Appointment.js";
import Customer from "../../models/customer.js";
import {
  recordDomainEvent,
} from "../integrationPlatform/webhookProjectionService.js";
import {
  verifyBookingRecoveryToken,
} from "./bookingRecoveryToken.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

const RECOVERABLE_STATUSES = new Set(["abandoned", "recovered", "active"]);
const DEFAULT_INACTIVITY_MINUTES = 30;
const DEFAULT_RECOVERY_HOURS = 24;

function text(value) {
  return String(value ?? "").trim();
}

function objectId(value, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === "") && optional) {
    return null;
  }
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, {
      field,
    });
  }
  return value;
}

function userId(user) {
  const value = user?._id || user?.id;
  return objectId(value, "user");
}

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normaliseDate(value) {
  const result = text(value);
  if (result && !/^\d{4}-\d{2}-\d{2}$/.test(result)) {
    throw createServiceError("appointmentDate must use YYYY-MM-DD.", 400, {
      field: "appointmentDate",
    });
  }
  return result;
}

function normaliseTime(value) {
  const result = text(value);
  if (result && !/^([01]\d|2[0-3]):[0-5]\d$/.test(result)) {
    throw createServiceError("appointmentTime must use HH:mm.", 400, {
      field: "appointmentTime",
    });
  }
  return result;
}

async function customerForUser(user) {
  const id = userId(user);
  if (mongoose.isValidObjectId(user?.customerProfile)) {
    const linked = await Customer.findOne({
      _id: user.customerProfile,
      status: { $ne: "deleted" },
    });
    if (linked) return linked;
  }

  return Customer.findOne({
    userAccount: id,
    status: { $ne: "deleted" },
  });
}

async function populatedIntent(intentId) {
  return AbandonedBookingIntent.findById(intentId)
    .populate("service", "name category description price duration active published bookable image")
    .populate("stylist", "name firstName lastName profileImage specialties rating active isActive acceptsAppointments")
    .lean();
}

function safeIntent(intent) {
  if (!intent) return null;
  return {
    id: String(intent._id),
    status: intent.status,
    sourceChannel: intent.sourceChannel,
    communicationClassification: intent.communicationClassification,
    service: intent.service || null,
    stylist: intent.stylist || null,
    appointmentDate: intent.appointmentDate || "",
    appointmentTime: intent.appointmentTime || "",
    lastActivityAt: intent.lastActivityAt || null,
    abandonedAt: intent.abandonedAt || null,
    recoverableUntil: intent.recoverableUntil || null,
    recoveredAt: intent.recoveredAt || null,
    convertedAt: intent.convertedAt || null,
    appointment: intent.appointment || null,
    recoveryCount: Number(intent.recoveryCount || 0),
  };
}

export async function saveBookingRecoveryIntent(payload = {}, { user } = {}) {
  const id = userId(user);
  const customer = await customerForUser(user);
  let intent = await AbandonedBookingIntent.findOne({
    user: id,
    sourceChannel: "website",
    status: { $in: ["active", "recovered"] },
  }).sort({ updatedAt: -1, _id: -1 });

  if (!intent) {
    intent = new AbandonedBookingIntent({
      user: id,
      customer: customer?._id || null,
      business: customer?.business || undefined,
      sourceChannel: "website",
      status: "active",
      // Recovery reminders are promotional completion nudges and therefore
      // fail closed through the marketing-consent policy by default.
      communicationClassification: "marketing",
    });
  }

  if (customer) {
    intent.customer = customer._id;
    if (customer.business) intent.business = customer.business;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "service")) {
    intent.service = payload.service
      ? objectId(payload.service, "service", { optional: true })
      : null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "stylist")) {
    intent.stylist = payload.stylist
      ? objectId(payload.stylist, "stylist", { optional: true })
      : null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "appointmentDate")) {
    intent.appointmentDate = normaliseDate(payload.appointmentDate);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "appointmentTime")) {
    intent.appointmentTime = normaliseTime(payload.appointmentTime);
  }

  intent.lastActivityAt = new Date();
  if (intent.status === "active") {
    intent.abandonedAt = null;
    intent.recoverableUntil = null;
    intent.workflowEventId = "";
  }
  await intent.save();
  return safeIntent(await populatedIntent(intent._id));
}

async function intentFromToken(token, user, { requireRecoverable = true } = {}) {
  const verified = verifyBookingRecoveryToken(token);
  const intent = assertFound(
    await AbandonedBookingIntent.findOne({
      _id: objectId(verified.intentId, "bookingRecoveryIntent"),
      user: userId(user),
    }),
    "Booking recovery journey not found."
  );

  if (requireRecoverable && !RECOVERABLE_STATUSES.has(intent.status)) {
    throw createServiceError(
      `A ${intent.status} booking recovery journey cannot be resumed.`,
      409,
      { code: "BOOKING_RECOVERY_NOT_RESUMABLE" }
    );
  }
  if (
    requireRecoverable &&
    intent.recoverableUntil &&
    new Date(intent.recoverableUntil) <= new Date()
  ) {
    intent.status = "expired";
    await intent.save();
    throw createServiceError("The booking recovery link has expired.", 410, {
      code: "BOOKING_RECOVERY_TOKEN_EXPIRED",
    });
  }
  return intent;
}

export async function getBookingRecoveryIntent(token, { user } = {}) {
  const intent = await intentFromToken(token, user);
  return safeIntent(await populatedIntent(intent._id));
}

export async function resumeBookingRecoveryIntent(token, { user } = {}) {
  const intent = await intentFromToken(token, user);
  if (intent.status !== "recovered") {
    intent.status = "recovered";
    intent.recoveredAt = new Date();
    intent.recoveryCount = Number(intent.recoveryCount || 0) + 1;
  }
  intent.lastActivityAt = new Date();
  await intent.save();
  return safeIntent(await populatedIntent(intent._id));
}

export async function attributeRecoveredAppointment(
  token,
  appointmentId,
  { user } = {}
) {
  const intent = await intentFromToken(token, user);
  const appointment = assertFound(
    await Appointment.findById(objectId(appointmentId, "appointment")),
    "Appointment not found."
  );
  const customer = assertFound(
    await Customer.findOne({
      _id: appointment.customer,
      status: { $ne: "deleted" },
    }),
    "Appointment customer not found."
  );

  const ownsCustomer =
    String(customer.userAccount || "") === String(userId(user)) ||
    String(user?.customerProfile || "") === String(customer._id);
  if (!ownsCustomer) {
    throw createServiceError("The appointment does not belong to this recovery journey.", 403, {
      code: "BOOKING_RECOVERY_APPOINTMENT_OWNERSHIP_MISMATCH",
    });
  }
  if (
    intent.customer &&
    String(intent.customer) !== String(customer._id)
  ) {
    throw createServiceError("The recovery journey belongs to a different customer.", 409, {
      code: "BOOKING_RECOVERY_CUSTOMER_MISMATCH",
    });
  }

  const trustedBusiness =
    appointment.business || customer.business || intent.business || undefined;
  if (
    intent.business &&
    trustedBusiness &&
    String(intent.business) !== String(trustedBusiness)
  ) {
    throw createServiceError("The recovery journey belongs to a different business.", 409, {
      code: "BOOKING_RECOVERY_BUSINESS_MISMATCH",
    });
  }

  intent.customer = customer._id;
  if (trustedBusiness) intent.business = trustedBusiness;
  if (appointment.location) intent.location = appointment.location;
  intent.appointment = appointment._id;
  intent.status = "converted";
  intent.convertedAt = new Date();
  intent.lastActivityAt = new Date();
  await intent.save();

  if (trustedBusiness) {
    await recordDomainEvent({
      businessId: String(trustedBusiness),
      type: "booking.recovered",
      version: "1",
      aggregateType: "abandoned_booking_intent",
      aggregateId: String(intent._id),
      payload: {
        intentId: String(intent._id),
        appointmentId: String(appointment._id),
        customerId: String(customer._id),
        sourceChannel: intent.sourceChannel,
        recoveryCount: Number(intent.recoveryCount || 0),
      },
      source: "booking-recovery",
    });
  }

  return safeIntent(await populatedIntent(intent._id));
}

export async function markStaleBookingIntentsAbandoned(options = {}) {
  const inactivityMinutes = boundedNumber(
    options.inactivityMinutes,
    DEFAULT_INACTIVITY_MINUTES,
    5,
    24 * 60
  );
  const recoveryHours = boundedNumber(
    options.recoveryHours,
    DEFAULT_RECOVERY_HOURS,
    1,
    14 * 24
  );
  const limit = boundedNumber(options.limit, 50, 1, 200);
  const threshold = new Date(Date.now() - inactivityMinutes * 60 * 1000);

  const candidates = await AbandonedBookingIntent.find({
    status: { $in: ["active", "recovered"] },
    lastActivityAt: { $lte: threshold },
    $or: [
      { service: { $ne: null } },
      { stylist: { $ne: null } },
      { appointmentDate: { $ne: "" } },
      { appointmentTime: { $ne: "" } },
    ],
  })
    .sort({ lastActivityAt: 1, _id: 1 })
    .limit(limit);

  const abandoned = [];
  for (const intent of candidates) {
    intent.status = "abandoned";
    intent.abandonedAt = new Date();
    intent.recoverableUntil = new Date(Date.now() + recoveryHours * 60 * 60 * 1000);
    intent.workflowEventId = "";
    await intent.save();
    abandoned.push(String(intent._id));
  }
  return abandoned;
}

export async function expireBookingRecoveryIntents({ limit = 100 } = {}) {
  const ids = await AbandonedBookingIntent.find({
    status: "abandoned",
    recoverableUntil: { $lte: new Date() },
  })
    .sort({ recoverableUntil: 1, _id: 1 })
    .limit(Math.max(1, Math.min(500, Number(limit) || 100)))
    .select("_id")
    .lean();

  if (ids.length === 0) return 0;
  const result = await AbandonedBookingIntent.updateMany(
    { _id: { $in: ids.map((item) => item._id) }, status: "abandoned" },
    { $set: { status: "expired" } }
  );
  return Number(result.modifiedCount || 0);
}

export async function emitPendingBookingRecoveryEvents({ limit = 50 } = {}) {
  const intents = await AbandonedBookingIntent.find({
    status: "abandoned",
    business: { $exists: true, $ne: null },
    customer: { $ne: null },
    recoverableUntil: { $gt: new Date() },
    $or: [
      { workflowEventId: "" },
      { workflowEventId: { $exists: false } },
    ],
  })
    .sort({ abandonedAt: 1, _id: 1 })
    .limit(Math.max(1, Math.min(200, Number(limit) || 50)));

  const events = [];
  for (const intent of intents) {
    const recorded = await recordDomainEvent({
      businessId: String(intent.business),
      type: "booking.abandoned",
      version: "1",
      aggregateType: "abandoned_booking_intent",
      aggregateId: String(intent._id),
      payload: {
        intentId: String(intent._id),
        customerId: String(intent.customer),
        userId: String(intent.user),
        serviceId: intent.service ? String(intent.service) : "",
        stylistId: intent.stylist ? String(intent.stylist) : "",
        appointmentDate: intent.appointmentDate || "",
        appointmentTime: intent.appointmentTime || "",
        communicationClassification: intent.communicationClassification,
        recoverableUntil: intent.recoverableUntil,
      },
      source: "booking-recovery",
    });
    intent.workflowEventId = recorded.event.eventId;
    await intent.save();
    events.push(recorded.event.eventId);
  }
  return events;
}

export async function processBookingRecoveryTick(options = {}) {
  const expired = await expireBookingRecoveryIntents({
    limit: options.expireLimit || 100,
  });
  const abandoned = await markStaleBookingIntentsAbandoned({
    inactivityMinutes: options.inactivityMinutes,
    recoveryHours: options.recoveryHours,
    limit: options.abandonLimit || 50,
  });
  const events = await emitPendingBookingRecoveryEvents({
    limit: options.eventLimit || 50,
  });
  return { expired, abandoned, events };
}

export default {
  attributeRecoveredAppointment,
  emitPendingBookingRecoveryEvents,
  expireBookingRecoveryIntents,
  getBookingRecoveryIntent,
  markStaleBookingIntentsAbandoned,
  processBookingRecoveryTick,
  resumeBookingRecoveryIntent,
  saveBookingRecoveryIntent,
};
