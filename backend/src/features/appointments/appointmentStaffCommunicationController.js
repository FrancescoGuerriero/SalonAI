import mongoose from "mongoose";

import TransactionalNotificationEvent from "../../models/TransactionalNotificationEvent.js";
import {
  notifyAppointmentReminder,
} from "./appointmentNotificationService.js";
import {
  createServiceError,
} from "../../shared/serviceError.js";

function text(value) {
  return String(value ?? "").trim();
}

function appointmentId(request) {
  const value = text(request.params?.id || request.params?.appointmentId);

  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError("Invalid appointment ID.", 400, {
      field: "appointmentId",
    });
  }

  return value;
}

function actorId(request) {
  const value = request.user?._id || request.user?.id || null;
  return mongoose.isValidObjectId(value) ? value : null;
}

export async function sendReminderNow(request, response) {
  const id = appointmentId(request);
  const hoursBefore = Math.max(
    1,
    Math.min(168, Number(request.body?.hoursBefore) || 24)
  );

  const result = await notifyAppointmentReminder(id, {
    hoursBefore,
    eventKeySuffix: `manual:${Date.now()}`,
    actorId: actorId(request),
  });

  return response.status(200).json({
    success: result?.success !== false,
    message: result?.skipped
      ? "Appointment reminder was not sent because the customer has no eligible reminder channel."
      : "Appointment reminder sent using the customer's communication preferences.",
    notification: result,
  });
}

export async function communicationHistory(request, response) {
  const id = appointmentId(request);
  const limit = Math.max(
    1,
    Math.min(100, Number(request.query?.limit) || 25)
  );

  const items = await TransactionalNotificationEvent.find({
    "metadata.appointmentId": id,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return response.status(200).json({
    success: true,
    appointmentId: id,
    items,
    total: items.length,
  });
}

export default {
  communicationHistory,
  sendReminderNow,
};
