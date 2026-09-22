import Appointment from "../../models/Appointment.js";
import {
  salonDayBounds,
} from "../../shared/salonTime.js";
import {
  createServiceError,
} from "../../shared/serviceError.js";
import {
  APPOINTMENT_POPULATE_OPTIONS,
  TERMINAL_STATUSES,
  createManagedAppointment,
} from "./appointmentManagementService.js";

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
    ].includes(normalised)
  ) {
    return false;
  }

  return fallback;
}

function frontDeskState(
  status
) {
  switch (
    normaliseText(status)
      .toLowerCase()
  ) {
    case "pending":
      return "waiting";

    case "confirmed":
      return "assigned";

    case "checked_in":
      return "checked_in";

    case "in_progress":
      return "in_service";

    case "completed":
      return "completed";

    case "cancelled":
      return "cancelled";

    case "no_show":
      return "no_show";

    default:
      return "waiting";
  }
}

function queueProjection(
  appointment,
  queuePosition = null
) {
  const value =
    typeof appointment?.toObject ===
    "function"
      ? appointment.toObject({
          virtuals: true,
        })
      : {
          ...appointment,
        };

  return {
    ...value,
    queuePosition,
    queuedAt:
      value.createdAt ||
      value.startsAt ||
      value.appointmentDate,
    frontDeskState:
      frontDeskState(
        value.status
      ),
  };
}

async function createWalkInAppointment(
  payload = {},
  {
    actor = null,
  } = {}
) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw createServiceError(
      "Walk-in appointment details are required.",
      400
    );
  }

  const appointment =
    await createManagedAppointment(
      {
        ...payload,
        status: "pending",
      },
      {
        actor,
        bookingSource:
          "walk_in",
      }
    );

  return queueProjection(
    appointment,
    null
  );
}

async function listWalkInQueue(
  query = {}
) {
  const {
    start,
    end,
  } =
    salonDayBounds(
      query.date ||
        query.startDate ||
        new Date()
    );

  const includeTerminal =
    normaliseBoolean(
      query.includeTerminal,
      false
    );

  const match = {
    bookingSource:
      "walk_in",
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

  if (!includeTerminal) {
    match.status = {
      $nin:
        TERMINAL_STATUSES,
    };
  }

  const appointments =
    await Appointment.find(
      match
    )
      .populate(
        APPOINTMENT_POPULATE_OPTIONS
      )
      .sort({
        createdAt: 1,
        startsAt: 1,
        _id: 1,
      })
      .lean({
        virtuals: true,
      });

  return appointments.map(
    (
      appointment,
      index
    ) =>
      queueProjection(
        appointment,
        index + 1
      )
  );
}

export {
  createWalkInAppointment,
  frontDeskState,
  listWalkInQueue,
  queueProjection,
};

export default {
  createWalkInAppointment,
  listWalkInQueue,
};
