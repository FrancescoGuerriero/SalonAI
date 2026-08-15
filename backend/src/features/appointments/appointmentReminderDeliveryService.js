import Appointment from "../../models/Appointment.js";
import {
  notifyAppointmentReminder,
} from "./appointmentNotificationService.js";

function numberBetween(
  value,
  fallback,
  minimum,
  maximum
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, parsed)
  );
}

function appointmentStart(
  appointment
) {
  if (appointment?.startsAt) {
    const start =
      new Date(appointment.startsAt);

    if (!Number.isNaN(start.getTime())) {
      return start;
    }
  }

  const date =
    new Date(appointment?.appointmentDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const [hours = "0", minutes = "0"] =
    String(
      appointment?.appointmentTime ||
        "00:00"
    ).split(":");

  date.setHours(
    Number(hours) || 0,
    Number(minutes) || 0,
    0,
    0
  );

  return date;
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

export async function deliverDueAppointmentReminders({
  now = new Date(),
  hoursBefore = 24,
  lookAheadHours = 48,
  limit = 500,
  actorId = null,
} = {}) {
  const referenceTime = new Date(now);

  if (Number.isNaN(referenceTime.getTime())) {
    const error = new Error(
      "Appointment reminder cycle requires a valid reference time."
    );
    error.statusCode = 400;
    error.code =
      "INVALID_APPOINTMENT_REMINDER_REFERENCE_TIME";
    throw error;
  }

  const safeHoursBefore =
    numberBetween(
      hoursBefore,
      24,
      0,
      8760
    );

  const safeLookAheadHours =
    numberBetween(
      lookAheadHours,
      Math.max(48, safeHoursBefore),
      1,
      8760
    );

  const safeLimit = Math.round(
    numberBetween(limit, 500, 1, 5000)
  );

  const upper = new Date(
    referenceTime.getTime() +
      safeLookAheadHours * 60 * 60 * 1000
  );

  const appointments =
    await Appointment.find({
      status: {
        $in: ["pending", "confirmed"],
      },
      $or: [
        {
          startsAt: {
            $gte: referenceTime,
            $lte: upper,
          },
        },
        {
          appointmentDate: {
            $gte: startOfDay(referenceTime),
            $lte: endOfDay(upper),
          },
        },
      ],
    })
      .select(
        "_id startsAt appointmentDate appointmentTime status"
      )
      .sort({
        startsAt: 1,
        appointmentDate: 1,
        appointmentTime: 1,
      })
      .limit(safeLimit)
      .lean();

  const items = [];

  for (const appointment of appointments) {
    const start =
      appointmentStart(appointment);

    if (
      !start ||
      start <= referenceTime ||
      start > upper
    ) {
      continue;
    }

    const dueAt = new Date(
      start.getTime() -
        safeHoursBefore * 60 * 60 * 1000
    );

    if (dueAt > referenceTime) {
      continue;
    }

    try {
      const notification =
        await notifyAppointmentReminder(
          appointment._id,
          {
            hoursBefore:
              safeHoursBefore,
            eventKeySuffix:
              start.toISOString(),
            actorId,
          }
        );

      const skipped = Boolean(
        notification?.skipped ||
          notification?.duplicate
      );

      items.push({
        appointmentId:
          String(appointment._id),
        success:
          notification?.success !== false,
        sent:
          notification?.success !== false &&
          !skipped,
        skipped,
        duplicate:
          Boolean(notification?.duplicate),
        reason:
          notification?.reason || null,
        startsAt:
          start.toISOString(),
        dueAt:
          dueAt.toISOString(),
        notification,
      });
    } catch (error) {
      items.push({
        appointmentId:
          String(appointment._id),
        success: false,
        sent: false,
        skipped: false,
        duplicate: false,
        startsAt:
          start.toISOString(),
        dueAt:
          dueAt.toISOString(),
        error: {
          message:
            error?.message ||
            "Appointment reminder delivery failed.",
          code:
            error?.code ||
            "APPOINTMENT_REMINDER_DELIVERY_FAILED",
          statusCode:
            Number(
              error?.statusCode ||
                error?.status
            ) || 500,
        },
      });
    }
  }

  const sent =
    items.filter((item) => item.sent).length;
  const skipped =
    items.filter((item) => item.skipped).length;
  const failed =
    items.filter((item) => !item.success).length;

  return {
    success: failed === 0,
    checked: appointments.length,
    due: items.length,
    sent,
    skipped,
    failed,
    hoursBefore: safeHoursBefore,
    lookAheadHours: safeLookAheadHours,
    referenceTime:
      referenceTime.toISOString(),
    items,
  };
}

export default {
  deliverDueAppointmentReminders,
};
