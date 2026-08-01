import {
  bulkChangeAppointmentStatus,
  calendarAppointments,
  changeAppointmentStatus,
  checkAppointmentConflict,
  getAppointmentManagementSummary,
  getManagedAppointment,
  queueAppointmentReminder,
  queueUpcomingReminders,
  rescheduleAppointment,
} from "./appointmentManagementService.js";

import {
  createServiceError,
} from "../../shared/serviceError.js";

function normaliseText(value) {
  return String(
    value ?? ""
  ).trim();
}

function normaliseBoolean(
  value,
  fallback = false
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  const normalised =
    normaliseText(value)
      .toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "on",
      "enabled",
    ].includes(normalised)
  ) {
    return true;
  }

  if (
    [
      "false",
      "0",
      "no",
      "off",
      "disabled",
    ].includes(normalised)
  ) {
    return false;
  }

  return fallback;
}

function getActor(request) {
  return request.user || null;
}

function getAppointmentId(
  request
) {
  const appointmentId =
    normaliseText(
      request.params?.id ||
        request.params
          ?.appointmentId
    );

  if (!appointmentId) {
    throw createServiceError(
      "An appointment identifier is required.",
      400,
      {
        field:
          "appointmentId",
      }
    );
  }

  return appointmentId;
}

function getRequestBody(
  request
) {
  if (
    !request.body ||
    typeof request.body !==
      "object" ||
    Array.isArray(
      request.body
    )
  ) {
    return {};
  }

  return request.body;
}

function serialiseDocument(
  value
) {
  if (!value) {
    return value;
  }

  if (
    typeof value.toJSON ===
    "function"
  ) {
    return value.toJSON();
  }

  if (
    typeof value.toObject ===
    "function"
  ) {
    return value.toObject();
  }

  return value;
}

/*
|--------------------------------------------------------------------------
| Calendar
|--------------------------------------------------------------------------
*/

async function calendar(
  request,
  response
) {
  const items =
    await calendarAppointments(
      request.query || {}
    );

  return response
    .status(200)
    .json({
      success: true,

      message:
        "Appointment calendar retrieved successfully.",

      items:
        items.map(
          serialiseDocument
        ),

      total:
        items.length,
    });
}

async function summary(
  request,
  response
) {
  const appointmentSummary =
    await getAppointmentManagementSummary(
      request.query || {}
    );

  return response
    .status(200)
    .json({
      success: true,

      message:
        "Appointment management summary retrieved successfully.",

      summary:
        appointmentSummary,
    });
}

/*
|--------------------------------------------------------------------------
| Individual appointment
|--------------------------------------------------------------------------
*/

async function getAppointment(
  request,
  response
) {
  const appointment =
    await getManagedAppointment(
      getAppointmentId(
        request
      )
    );

  return response
    .status(200)
    .json({
      success: true,

      message:
        "Appointment retrieved successfully.",

      appointment:
        serialiseDocument(
          appointment
        ),
    });
}

/*
|--------------------------------------------------------------------------
| Conflict checking
|--------------------------------------------------------------------------
*/

async function conflict(
  request,
  response
) {
  const body =
    getRequestBody(
      request
    );

  const result =
    await checkAppointmentConflict({
      ...body,

      excludeAppointmentId:
        body.excludeAppointmentId ||
        request.query
          ?.excludeAppointmentId ||
        null,
    });

  return response
    .status(200)
    .json({
      success: true,

      message:
        result.hasConflict
          ? "An overlapping appointment was found."
          : "No overlapping appointment was found.",

      ...result,
    });
}

/*
|--------------------------------------------------------------------------
| Rescheduling
|--------------------------------------------------------------------------
*/

async function reschedule(
  request,
  response
) {
  const body =
    getRequestBody(
      request
    );

  const appointment =
    await rescheduleAppointment(
      getAppointmentId(
        request
      ),
      {
        ...body,

        force:
          normaliseBoolean(
            body.force,
            false
          ),
      },
      {
        actor:
          getActor(request),
      }
    );

  return response
    .status(200)
    .json({
      success: true,

      message:
        "Appointment rescheduled successfully.",

      appointment:
        serialiseDocument(
          appointment
        ),
    });
}

/*
|--------------------------------------------------------------------------
| Status workflow
|--------------------------------------------------------------------------
*/

async function status(
  request,
  response
) {
  const body =
    getRequestBody(
      request
    );

  const nextStatus =
    normaliseText(
      body.status
    );

  if (!nextStatus) {
    throw createServiceError(
      "An appointment status is required.",
      400,
      {
        field: "status",
      }
    );
  }

  const appointment =
    await changeAppointmentStatus(
      getAppointmentId(
        request
      ),
      nextStatus,
      {
        ...body,

        reason:
          normaliseText(
            body.reason
          ),

        requireReason:
          normaliseBoolean(
            body.requireReason,
            false
          ),
      },
      {
        actor:
          getActor(request),
      }
    );

  return response
    .status(200)
    .json({
      success: true,

      message:
        "Appointment status updated successfully.",

      appointment:
        serialiseDocument(
          appointment
        ),
    });
}

async function bulkStatus(
  request,
  response
) {
  const body =
    getRequestBody(
      request
    );

  const result =
    await bulkChangeAppointmentStatus(
      {
        appointmentIds:
          Array.isArray(
            body.appointmentIds
          )
            ? body
                .appointmentIds
            : [],

        status:
          normaliseText(
            body.status
          ),

        reason:
          normaliseText(
            body.reason
          ),

        requireReason:
          normaliseBoolean(
            body.requireReason,
            false
          ),
      },
      {
        actor:
          getActor(request),
      }
    );

  const statusCode =
    result.failed > 0 &&
    result.updated === 0
      ? 422
      : 200;

  return response
    .status(statusCode)
    .json({
      success:
        result.failed === 0,

      partialSuccess:
        result.updated > 0 &&
        result.failed > 0,

      message:
        result.failed === 0
          ? `${result.updated} appointment status update${
              result.updated === 1
                ? ""
                : "s"
            } completed successfully.`
          : `${result.updated} appointment${
              result.updated === 1
                ? ""
                : "s"
            } updated and ${result.failed} failed.`,

      ...result,
    });
}

/*
|--------------------------------------------------------------------------
| Reminder management
|--------------------------------------------------------------------------
*/

async function reminder(
  request,
  response
) {
  const body =
    getRequestBody(
      request
    );

  const queuedReminder =
    await queueAppointmentReminder(
      getAppointmentId(
        request
      ),
      {
        hoursBefore:
          body.hoursBefore,

        channel:
          body.channel,

        subject:
          body.subject,

        message:
          body.message,
      }
    );

  return response
    .status(201)
    .json({
      success: true,

      message:
        "Appointment reminder queued successfully.",

      reminder:
        serialiseDocument(
          queuedReminder
        ),
    });
}

async function queueReminders(
  request,
  response
) {
  const body =
    getRequestBody(
      request
    );

  const items =
    await queueUpcomingReminders({
      hoursBefore:
        body.hoursBefore,

      channel:
        body.channel,

      lookAheadHours:
        body.lookAheadHours,
    });

  const successful =
    items.filter(
      (item) =>
        item.success
    ).length;

  const failed =
    items.filter(
      (item) =>
        !item.success
    ).length;

  return response
    .status(200)
    .json({
      success:
        failed === 0,

      partialSuccess:
        successful > 0 &&
        failed > 0,

      message:
        `${successful} reminder${
          successful === 1
            ? ""
            : "s"
        } queued and ${failed} failed.`,

      queued:
        successful,

      failed,

      items,
    });
}

/*
|--------------------------------------------------------------------------
| Compatibility aliases
|--------------------------------------------------------------------------
*/

export {
  bulkStatus,
  bulkStatus as bulkChangeStatus,

  calendar,
  calendar as getCalendar,

  conflict,
  conflict as checkConflict,

  getAppointment,
  getAppointment as get,

  queueReminders,
  queueReminders as queueUpcoming,

  reminder,
  reminder as queueReminder,

  reschedule,
  reschedule as rescheduleOne,

  status,
  status as changeStatus,

  summary,
  summary as getSummary,
};

export default {
  bulkStatus,
  calendar,
  conflict,
  getAppointment,
  queueReminders,
  reminder,
  reschedule,
  status,
  summary,
};