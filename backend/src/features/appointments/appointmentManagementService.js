import mongoose from "mongoose";

/*
 * Register every model referenced by Appointment.populate().
 * These imports are intentionally executed for their side effects.
 */
import "../../models/customer.js";
import "../../models/Stylist.js";
import "../../models/user.js";

import Appointment, {
  APPOINTMENT_STATUSES,
  PAYMENT_STATUSES,
} from "../../models/Appointment.js";
import Service from "../../models/service.js";
import ScheduledCommunication from "../scheduler/ScheduledCommunication.js";
import {
  assertAppointmentWithinStaffAvailability,
} from "../staff/staffService.js";

import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import {
  addSalonDays,
  combineSalonDateAndTime,
  formatSalonTime,
  salonDateAnchor,
  salonDayBounds,
} from "../../shared/salonTime.js";
import {
  buildCustomerContext,
  renderTemplate,
} from "../../shared/templateRenderer.js";

const SUPPORTED_CHANNELS = ["email", "sms"];

const TERMINAL_STATUSES = [
  "completed",
  "cancelled",
  "no_show",
];

const APPOINTMENT_POPULATE_OPTIONS = [
  {
    path: "customer",
    select:
      "firstName lastName fullName preferredName name email phone alternativePhone phoneNumber mobile status tags",
  },
  {
    path: "service",
    select:
      "name category description price duration active",
  },
  {
    path: "stylist",
    select:
      "name firstName lastName email phone status active",
  },
  {
    path: "createdBy",
    select: "name email role",
  },
  {
    path: "updatedBy",
    select: "name email role",
  },
  {
    path: "statusHistory.changedBy",
    select: "name email role",
  },
  {
    path: "rescheduleHistory.changedBy",
    select: "name email role",
  },
  {
    path: "rescheduleHistory.previousStylist",
    select: "name firstName lastName",
  },
  {
    path: "rescheduleHistory.newStylist",
    select: "name firstName lastName",
  },
];

function normaliseText(value) {
  return String(value ?? "").trim();
}

function normaliseLowercase(value) {
  return normaliseText(value).toLowerCase();
}

function escapeRegularExpression(value) {
  return normaliseText(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
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

  if (typeof value === "boolean") {
    return value;
  }

  const normalisedValue =
    normaliseLowercase(value);

  if (
    [
      "true",
      "1",
      "yes",
      "on",
      "enabled",
    ].includes(normalisedValue)
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
    ].includes(normalisedValue)
  ) {
    return false;
  }

  return fallback;
}

function normaliseNumber(
  value,
  fallback,
  {
    minimum = null,
    maximum = null,
  } = {}
) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  let result = parsedValue;

  if (minimum !== null) {
    result = Math.max(
      minimum,
      result
    );
  }

  if (maximum !== null) {
    result = Math.min(
      maximum,
      result
    );
  }

  return result;
}

function normaliseInteger(
  value,
  fallback,
  options = {}
) {
  return Math.round(
    normaliseNumber(
      value,
      fallback,
      options
    )
  );
}

function normaliseArray(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return [];
  }

  const values = Array.isArray(value)
    ? value
    : normaliseText(value).split(",");

  return Array.from(
    new Set(
      values
        .map((entry) =>
          normaliseLowercase(entry)
        )
        .filter(Boolean)
    )
  );
}

function assertValidObjectId(
  value,
  fieldName
) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(
      `${fieldName} must be a valid identifier.`,
      400,
      {
        field: fieldName,
      }
    );
  }

  return value;
}

function getActorId(actor) {
  const actorId =
    actor?._id ||
    actor?.id ||
    actor ||
    null;

  return mongoose.isValidObjectId(actorId)
    ? actorId
    : null;
}

function parseDate(
  value,
  fieldName
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createServiceError(
      `${fieldName} must be a valid date.`,
      400,
      {
        field: fieldName,
      }
    );
  }

  return date;
}

function combineDateAndTime(
  dateValue,
  timeValue
) {
  const time =
    normaliseText(
      timeValue || "00:00"
    );

  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(
      time
    )
  ) {
    throw createServiceError(
      "Appointment time must use HH:mm format.",
      400,
      {
        field:
          "appointmentTime",
      }
    );
  }

  return combineSalonDateAndTime(
    dateValue,
    time,
    {
      dateField:
        "appointmentDate",
      timeField:
        "appointmentTime",
    }
  );
}

function formatTime(
  value
) {
  return formatSalonTime(
    value
  );
}

function getAppointmentStart(
  appointment
) {
  if (appointment?.startsAt) {
    const start = new Date(
      appointment.startsAt
    );

    if (!Number.isNaN(start.getTime())) {
      return start;
    }
  }

  return combineDateAndTime(
    appointment?.appointmentDate,
    appointment?.appointmentTime
  );
}

function getAppointmentEnd(
  appointment
) {
  if (appointment?.endsAt) {
    const end = new Date(
      appointment.endsAt
    );

    if (!Number.isNaN(end.getTime())) {
      return end;
    }
  }

  const start =
    getAppointmentStart(appointment);

  const duration = normaliseInteger(
    appointment?.duration,
    60,
    {
      minimum: 1,
      maximum: 1440,
    }
  );

  return new Date(
    start.getTime() +
      duration * 60000
  );
}

function appointmentWindow(
  payload,
  service
) {
  const supplied =
    payload &&
    typeof payload === "object"
      ? payload
      : {};

  const start = supplied.startsAt
    ? parseDate(
        supplied.startsAt,
        "startsAt"
      )
    : combineDateAndTime(
        supplied.appointmentDate,
        supplied.appointmentTime
      );

  const duration = normaliseInteger(
    supplied.duration ??
      service?.duration,
    60,
    {
      minimum: 1,
      maximum: 1440,
    }
  );

  const end = supplied.endsAt
    ? parseDate(
        supplied.endsAt,
        "endsAt"
      )
    : new Date(
        start.getTime() +
          duration * 60000
      );

  if (end.getTime() <= start.getTime()) {
    throw createServiceError(
      "The appointment end time must be after its start time.",
      400,
      {
        field: "endsAt",
      }
    );
  }

  const calculatedDuration = Math.max(
    1,
    Math.round(
      (end.getTime() -
        start.getTime()) /
        60000
    )
  );

  return {
    start,
    end,
    duration: calculatedDuration,
  };
}

function assertSupportedStatus(status) {
  const normalisedStatus =
    normaliseLowercase(status).replaceAll(
      "-",
      "_"
    );

  if (
    !APPOINTMENT_STATUSES.includes(
      normalisedStatus
    )
  ) {
    throw createServiceError(
      `Status must be one of: ${APPOINTMENT_STATUSES.join(
        ", "
      )}.`,
      400,
      {
        field: "status",
      }
    );
  }

  return normalisedStatus;
}

function assertSupportedPaymentStatus(
  status
) {
  const normalisedStatus =
    normaliseLowercase(status).replaceAll(
      "-",
      "_"
    );

  if (
    !PAYMENT_STATUSES.includes(
      normalisedStatus
    )
  ) {
    throw createServiceError(
      `Payment status must be one of: ${PAYMENT_STATUSES.join(
        ", "
      )}.`,
      400,
      {
        field: "paymentStatus",
      }
    );
  }

  return normalisedStatus;
}

function assertSupportedChannel(
  channel
) {
  const normalisedChannel =
    normaliseLowercase(channel || "sms");

  if (
    !SUPPORTED_CHANNELS.includes(
      normalisedChannel
    )
  ) {
    throw createServiceError(
      `Channel must be one of: ${SUPPORTED_CHANNELS.join(
        ", "
      )}.`,
      400,
      {
        field: "channel",
      }
    );
  }

  return normalisedChannel;
}

async function getManagedAppointment(
  appointmentId,
  {
    lean = true,
  } = {}
) {
  assertValidObjectId(
    appointmentId,
    "appointmentId"
  );

  let query = Appointment.findById(
    appointmentId
  )
    .select("+internalNotes")
    .populate(
      APPOINTMENT_POPULATE_OPTIONS
    );

  if (lean) {
    query = query.lean({
      virtuals: true,
    });
  }

  return assertFound(
    await query,
    "Appointment not found."
  );
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
}) {
  assertValidObjectId(
    stylist,
    "stylist"
  );

  const startDate = parseDate(
    start,
    "start"
  );

  const endDate = parseDate(
    end,
    "end"
  );

  if (endDate <= startDate) {
    throw createServiceError(
      "Conflict-check end time must be after the start time.",
      400
    );
  }

  const {
    start: conflictDayStart,
    end: conflictDayEnd,
  } =
    salonDayBounds(
      startDate
    );

  const match = {
    stylist,

    status: {
      $nin: [
        "cancelled",
        "no_show",
      ],
    },

    $or: [
      {
        startsAt: {
          $lt: endDate,
        },

        endsAt: {
          $gt: startDate,
        },
      },

      {
        appointmentDate: {
          $gte:
            conflictDayStart,

          $lte:
            conflictDayEnd,
        },
      },
    ],
  };

  if (excludeAppointmentId) {
    assertValidObjectId(
      excludeAppointmentId,
      "excludeAppointmentId"
    );

    match._id = {
      $ne: excludeAppointmentId,
    };
  }

  const candidates =
    await Appointment.find(match)
      .select(
        "customer stylist service appointmentDate appointmentTime startsAt endsAt duration status"
      )
      .populate(
        "customer",
        "firstName lastName fullName name"
      )
      .populate(
        "service",
        "name duration"
      )
      .lean();

  return (
    candidates.find((appointment) => {
      const candidateStart =
        getAppointmentStart(
          appointment
        );

      const candidateEnd =
        getAppointmentEnd(
          appointment
        );

      return (
        candidateStart < endDate &&
        candidateEnd > startDate
      );
    }) || null
  );
}

async function checkAppointmentConflict(
  payload = {}
) {
  const stylist = payload.stylist;

  assertValidObjectId(
    stylist,
    "stylist"
  );

  let service = null;

  if (payload.service) {
    assertValidObjectId(
      payload.service,
      "service"
    );

    service = await Service.findById(
      payload.service
    ).lean();

    assertFound(
      service,
      "Service not found."
    );
  }

  const window = appointmentWindow(
    payload,
    service
  );

  const conflict = await findConflict({
    stylist,
    start: window.start,
    end: window.end,

    excludeAppointmentId:
      payload.excludeAppointmentId ||
      null,
  });

  return {
    hasConflict: Boolean(conflict),
    conflict,

    requestedWindow: {
      stylist,
      startsAt: window.start,
      endsAt: window.end,
      duration: window.duration,
    },
  };
}

/*
|--------------------------------------------------------------------------
| Calendar and appointment retrieval
|--------------------------------------------------------------------------
*/

function buildCalendarMatch(
  query = {}
) {
  const {
    start,
  } =
    salonDayBounds(
      query.startDate ||
        new Date()
    );

  const endSource =
    query.endDate ||
    addSalonDays(
      start,
      30
    );

  const {
    end,
  } =
    salonDayBounds(
      endSource
    );

  if (end < start) {
    throw createServiceError(
      "Calendar end date must not be before the start date.",
      400
    );
  }

  const match = {
    $or: [
      {
        startsAt: {
          $gte: start,
          $lte: end,
        },
      },

      {
        appointmentDate: {
          $gte: start,
          $lte: end,
        },
      },
    ],
  };

  if (query.stylist) {
    assertValidObjectId(
      query.stylist,
      "stylist"
    );

    match.stylist =
      query.stylist;
  }

  if (query.customer) {
    assertValidObjectId(
      query.customer,
      "customer"
    );

    match.customer =
      query.customer;
  }

  if (query.service) {
    assertValidObjectId(
      query.service,
      "service"
    );

    match.service =
      query.service;
  }

  const statuses =
    normaliseArray(query.status);

  if (statuses.length > 0) {
    match.status = {
      $in: statuses.map(
        assertSupportedStatus
      ),
    };
  }

  const paymentStatuses =
    normaliseArray(
      query.paymentStatus
    );

  if (paymentStatuses.length > 0) {
    match.paymentStatus = {
      $in: paymentStatuses.map(
        assertSupportedPaymentStatus
      ),
    };
  }

  const search =
    normaliseText(query.search);

  if (search) {
    const expression = new RegExp(
      escapeRegularExpression(search),
      "i"
    );

    match.$and = [
      {
        $or: [
          {
            notes: expression,
          },
          {
            internalNotes:
              expression,
          },
          {
            cancellationReason:
              expression,
          },
          {
            noShowReason:
              expression,
          },
          {
            invoiceNumber:
              expression,
          },
        ],
      },
    ];
  }

  return {
    start,
    end,
    match,
  };
}

async function calendarAppointments(
  query = {}
) {
  const {
    match,
  } = buildCalendarMatch(query);

  const limit = normaliseInteger(
    query.limit,
    1000,
    {
      minimum: 1,
      maximum: 5000,
    }
  );

  return Appointment.find(match)
    .select("+internalNotes")
    .populate(
      APPOINTMENT_POPULATE_OPTIONS
    )
    .sort({
      startsAt: 1,
      appointmentDate: 1,
      appointmentTime: 1,
      _id: 1,
    })
    .limit(limit)
    .lean({
      virtuals: true,
    });
}

async function getAppointmentManagementSummary(
  query = {}
) {
  const {
    start,
    end,
    match,
  } = buildCalendarMatch(query);

  const [
    total,
    statusCounts,
    paymentCounts,
    financialSummary,
  ] = await Promise.all([
    Appointment.countDocuments(match),

    Appointment.aggregate([
      {
        $match: match,
      },
      {
        $group: {
          _id: "$status",
          total: {
            $sum: 1,
          },
        },
      },
    ]),

    Appointment.aggregate([
      {
        $match: match,
      },
      {
        $group: {
          _id: "$paymentStatus",
          total: {
            $sum: 1,
          },
        },
      },
    ]),

    Appointment.aggregate([
      {
        $match: match,
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: "$finalPrice",
          },
          totalPaid: {
            $sum: "$amountPaid",
          },
          totalOutstanding: {
            $sum: "$balanceDue",
          },
        },
      },
    ]),
  ]);

  const finances =
    financialSummary[0] || {
      totalRevenue: 0,
      totalPaid: 0,
      totalOutstanding: 0,
    };

  return {
    period: {
      start,
      end,
    },

    total,

    byStatus: Object.fromEntries(
      statusCounts.map((entry) => [
        entry._id,
        entry.total,
      ])
    ),

    byPaymentStatus:
      Object.fromEntries(
        paymentCounts.map((entry) => [
          entry._id,
          entry.total,
        ])
      ),

    totalRevenue:
      finances.totalRevenue || 0,

    totalPaid:
      finances.totalPaid || 0,

    totalOutstanding:
      finances.totalOutstanding || 0,
  };
}

/*
|--------------------------------------------------------------------------
| Rescheduling
|--------------------------------------------------------------------------
*/

async function rescheduleAppointment(
  appointmentId,
  payload = {},
  {
    actor = null,
  } = {}
) {
  assertValidObjectId(
    appointmentId,
    "appointmentId"
  );

  const appointment = assertFound(
    await Appointment.findById(
      appointmentId
    ).select("+internalNotes"),

    "Appointment not found."
  );

  if (
    TERMINAL_STATUSES.includes(
      appointment.status
    ) &&
    !normaliseBoolean(
      payload.force,
      false
    )
  ) {
    throw createServiceError(
      `A ${appointment.status} appointment cannot be rescheduled without force=true.`,
      409,
      {
        status: appointment.status,
      }
    );
  }

  const serviceId =
    payload.service ||
    appointment.service;

  assertValidObjectId(
    serviceId,
    "service"
  );

  const service = assertFound(
    await Service.findById(
      serviceId
    ).lean(),

    "Service not found."
  );

  const windowPayload = {
    ...appointment.toObject(),
    ...payload,
    service: serviceId,
  };

  /*
   * Existing appointments may already contain startsAt and endsAt.
   * Clear inherited values when a new date or time is supplied so the
   * requested date and time are used instead of the previous window.
   */
  if (
    !payload.startsAt &&
    (
      payload.appointmentDate ||
      payload.appointmentTime
    )
  ) {
    windowPayload.startsAt = null;

    if (!payload.endsAt) {
      windowPayload.endsAt = null;
    }
  }

  const window = appointmentWindow(
    windowPayload,
    service
  );

  const stylist =
    payload.stylist ||
    appointment.stylist;

  assertValidObjectId(
    stylist,
    "stylist"
  );

  await assertAppointmentWithinStaffAvailability(
    stylist,
    window.start,
    window.end
  );

  const conflict = await findConflict({
    stylist,
    start: window.start,
    end: window.end,

    excludeAppointmentId:
      appointment._id,
  });

  if (conflict) {
    throw createServiceError(
      "The stylist already has an overlapping appointment.",
      409,
      {
        conflict,
      }
    );
  }

  const changedBy =
    getActorId(actor) ||
    getActorId(payload.changedBy) ||
    getActorId(payload.updatedBy);

  const reason =
    normaliseText(payload.reason);

  if (
    typeof appointment.recordReschedule ===
    "function"
  ) {
    appointment.recordReschedule({
      stylist,
      startsAt: window.start,
      endsAt: window.end,
      reason,
      changedBy,
    });
  } else {
    appointment.stylist = stylist;
    appointment.startsAt =
      window.start;
    appointment.endsAt =
      window.end;
    appointment.appointmentDate =
      salonDateAnchor(
        window.start
      );

    appointment.appointmentTime =
      formatTime(
        window.start
      );
    appointment.duration =
      window.duration;
    appointment.rescheduledAt =
      new Date();

    appointment.rescheduleCount =
      Number(
        appointment.rescheduleCount
      ) + 1;
  }

  appointment.service = serviceId;
  appointment.duration =
    window.duration;
  appointment.updatedBy =
    changedBy;
  appointment.reminderSent =
    false;
  appointment.reminderSentAt =
    null;

  await appointment.save();

  return getManagedAppointment(
    appointment._id
  );
}

/*
|--------------------------------------------------------------------------
| Status workflow
|--------------------------------------------------------------------------
*/

async function changeAppointmentStatus(
  appointmentId,
  status,
  details = {},
  {
    actor = null,
  } = {}
) {
  assertValidObjectId(
    appointmentId,
    "appointmentId"
  );

  const nextStatus =
    assertSupportedStatus(status);

  const appointment = assertFound(
    await Appointment.findById(
      appointmentId
    ).select("+internalNotes"),

    "Appointment not found."
  );

  if (
    appointment.status === nextStatus
  ) {
    return getManagedAppointment(
      appointment._id
    );
  }

  const reason =
    normaliseText(details.reason);

  if (
    [
      "cancelled",
      "no_show",
    ].includes(nextStatus) &&
    normaliseBoolean(
      details.requireReason,
      false
    ) &&
    !reason
  ) {
    throw createServiceError(
      `A reason is required when marking an appointment as ${nextStatus}.`,
      400,
      {
        field: "reason",
      }
    );
  }

  const changedBy =
    getActorId(actor) ||
    getActorId(details.changedBy) ||
    getActorId(details.updatedBy);

  if (
    typeof appointment.recordStatusChange ===
    "function"
  ) {
    appointment.recordStatusChange({
      status: nextStatus,
      reason,
      changedBy,
    });
  } else {
    appointment.status =
      nextStatus;

    const now = new Date();

    if (
      nextStatus === "checked_in"
    ) {
      appointment.checkedInAt =
        now;
    }

    if (
      nextStatus === "in_progress"
    ) {
      appointment.startedAt =
        now;
    }

    if (
      nextStatus === "completed"
    ) {
      appointment.completedAt =
        now;
    }

    if (
      nextStatus === "cancelled"
    ) {
      appointment.cancelledAt =
        now;

      appointment.cancellationReason =
        reason;
    }

    if (
      nextStatus === "no_show"
    ) {
      appointment.noShowAt =
        now;

      appointment.noShowReason =
        reason;
    }
  }

  if (
    nextStatus !== "cancelled"
  ) {
    appointment.cancellationReason =
      nextStatus === "pending"
        ? ""
        : appointment
            .cancellationReason;
  }

  if (
    nextStatus !== "no_show"
  ) {
    appointment.noShowReason =
      nextStatus === "pending"
        ? ""
        : appointment.noShowReason;
  }

  appointment.updatedBy =
    changedBy;

  await appointment.save();

  return getManagedAppointment(
    appointment._id
  );
}

async function bulkChangeAppointmentStatus(
  {
    appointmentIds = [],
    status,
    reason = "",
    requireReason = false,
  } = {},
  {
    actor = null,
  } = {}
) {
  const identifiers = Array.from(
    new Set(
      (
        Array.isArray(
          appointmentIds
        )
          ? appointmentIds
          : []
      )
        .map(normaliseText)
        .filter(Boolean)
    )
  );

  if (identifiers.length === 0) {
    throw createServiceError(
      "At least one appointment identifier is required.",
      400,
      {
        field: "appointmentIds",
      }
    );
  }

  if (identifiers.length > 100) {
    throw createServiceError(
      "A maximum of 100 appointments can be updated at once.",
      400,
      {
        field: "appointmentIds",
      }
    );
  }

  const results = [];

  for (
    const appointmentId of
    identifiers
  ) {
    try {
      const appointment =
        await changeAppointmentStatus(
          appointmentId,
          status,
          {
            reason,
            requireReason,
          },
          {
            actor,
          }
        );

      results.push({
        appointmentId,
        success: true,
        appointment,
      });
    } catch (error) {
      results.push({
        appointmentId,
        success: false,
        error: error.message,

        statusCode:
          error.statusCode ||
          error.status ||
          500,
      });
    }
  }

  return {
    requested: identifiers.length,

    updated:
      results.filter(
        (result) => result.success
      ).length,

    failed:
      results.filter(
        (result) => !result.success
      ).length,

    results,
  };
}

/*
|--------------------------------------------------------------------------
| Appointment reminders
|--------------------------------------------------------------------------
*/

async function queueAppointmentReminder(
  appointmentId,
  {
    hoursBefore = 24,
    channel = "sms",
    subject =
      "Appointment reminder",
    message =
      "Hi {{customer.firstName}}, your appointment is on {{appointment.date}} at {{appointment.time}} with {{appointment.stylist}}.",
  } = {}
) {
  assertValidObjectId(
    appointmentId,
    "appointmentId"
  );

  const safeChannel =
    assertSupportedChannel(channel);

  const safeHoursBefore =
    normaliseNumber(
      hoursBefore,
      24,
      {
        minimum: 0,
        maximum: 8760,
      }
    );

  const appointment = assertFound(
    await Appointment.findById(
      appointmentId
    )
      .populate(
        "customer",
        "firstName lastName fullName preferredName name email phone alternativePhone phoneNumber mobile"
      )
      .populate(
        "service",
        "name price duration"
      )
      .populate(
        "stylist",
        "name firstName lastName email"
      ),

    "Appointment not found."
  );

  if (
    TERMINAL_STATUSES.includes(
      appointment.status
    )
  ) {
    throw createServiceError(
      `A reminder cannot be queued for a ${appointment.status} appointment.`,
      409,
      {
        status: appointment.status,
      }
    );
  }

  const customer =
    appointment.customer;

  if (!customer) {
    throw createServiceError(
      "The appointment does not have a valid customer.",
      400
    );
  }

  const recipient =
    safeChannel === "email"
      ? customer.email
      : customer.phone ||
        customer.alternativePhone ||
        customer.phoneNumber ||
        customer.mobile;

  if (!recipient) {
    throw createServiceError(
      `Customer does not have a recipient for ${safeChannel}.`,
      400,
      {
        channel: safeChannel,
      }
    );
  }

  const start =
    getAppointmentStart(
      appointment
    );

  const calculatedSchedule =
    new Date(
      start.getTime() -
        safeHoursBefore *
          60 *
          60 *
          1000
    );

  const now = new Date();

  const scheduledFor =
    calculatedSchedule < now
      ? now
      : calculatedSchedule;

  const context =
    buildCustomerContext(
      customer,
      appointment,
      appointment.service,
      appointment.stylist
    );

  return ScheduledCommunication.findOneAndUpdate(
    {
      appointment:
        appointment._id,

      communicationType:
        "appointment_reminder",

      channel: safeChannel,
    },

    {
      $set: {
        customer:
          customer._id,

        appointment:
          appointment._id,

        communicationType:
          "appointment_reminder",

        channel: safeChannel,

        recipient,

        subject:
          safeChannel === "email"
            ? renderTemplate(
                subject,
                context
              )
            : "",

        message:
          renderTemplate(
            message,
            context
          ),

        scheduledFor,

        status: "queued",

        failureReason: "",

        metadata: {
          hoursBefore:
            safeHoursBefore,

          appointmentStartsAt:
            start,

          queuedFrom:
            "appointment_management",
        },
      },
    },

    {
      upsert: true,
      new: true,
      setDefaultsOnInsert:
        true,
    }
  ).lean();
}

async function queueUpcomingReminders({
  hoursBefore = 24,
  channel = "sms",
  lookAheadHours = 48,
} = {}) {
  const safeChannel =
    assertSupportedChannel(channel);

  const safeHoursBefore =
    normaliseNumber(
      hoursBefore,
      24,
      {
        minimum: 0,
        maximum: 8760,
      }
    );

  const safeLookAheadHours =
    normaliseNumber(
      lookAheadHours,
      48,
      {
        minimum: 1,
        maximum: 8760,
      }
    );

  const now = new Date();

  const upper = new Date(
    now.getTime() +
      safeLookAheadHours *
        60 *
        60 *
        1000
  );

  /*
   * startsAt is an absolute instant,
   * but appointmentDate is a legacy
   * salon-calendar-day field.
   */
  const {
    start: reminderDayStart,
  } =
    salonDayBounds(
      now
    );

  const {
    end: reminderDayEnd,
  } =
    salonDayBounds(
      upper
    );

  const appointments =
    await Appointment.find({
      status: {
        $in: [
          "pending",
          "confirmed",
        ],
      },

      $or: [
        {
          startsAt: {
            $gte: now,
            $lte: upper,
          },
        },

        {
          appointmentDate: {
            $gte:
              reminderDayStart,
            $lte:
              reminderDayEnd,
          },
        },
      ],
    }).lean();

  const results = [];

  for (
    const appointment of
    appointments
  ) {
    try {
      const start =
        getAppointmentStart(
          appointment
        );

      if (
        start < now ||
        start > upper
      ) {
        continue;
      }

      const reminder =
        await queueAppointmentReminder(
          appointment._id,
          {
            hoursBefore:
              safeHoursBefore,

            channel:
              safeChannel,
          }
        );

      results.push({
        appointmentId:
          String(
            appointment._id
          ),

        success: true,

        reminder,
      });
    } catch (error) {
      results.push({
        appointmentId:
          String(
            appointment._id
          ),

        success: false,

        error: error.message,
      });
    }
  }

  return results;
}

export {
  APPOINTMENT_POPULATE_OPTIONS,
  SUPPORTED_CHANNELS,
  TERMINAL_STATUSES,
  appointmentWindow,
  bulkChangeAppointmentStatus,
  calendarAppointments,
  changeAppointmentStatus,
  checkAppointmentConflict,
  combineDateAndTime,
  findConflict,
  getAppointmentManagementSummary,
  getManagedAppointment,
  queueAppointmentReminder,
  queueUpcomingReminders,
  rescheduleAppointment,
};

export default {
  bulkChangeAppointmentStatus,
  calendarAppointments,
  changeAppointmentStatus,
  checkAppointmentConflict,
  findConflict,
  getAppointmentManagementSummary,
  getManagedAppointment,
  queueAppointmentReminder,
  queueUpcomingReminders,
  rescheduleAppointment,
};