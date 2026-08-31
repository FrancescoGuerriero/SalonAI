import {
  combineSalonDateAndTime,
  parseSalonDate,
  toSalonDateKey,
} from "../shared/salonTime.js";

const TIME_PATTERN =
  /^([01]\d|2[0-3]):[0-5]\d$/;

function createValidationError(
  message,
  field
) {
  const error =
    new Error(message);

  error.statusCode = 400;
  error.status = 400;
  error.details = {
    field,
  };

  return error;
}

function timeToMinutes(
  value,
  field = "time"
) {
  const time =
    String(value || "").trim();

  if (
    !TIME_PATTERN.test(time)
  ) {
    throw createValidationError(
      `${field} must use HH:mm format.`,
      field
    );
  }

  const [
    hours,
    minutes,
  ] =
    time
      .split(":")
      .map(Number);

  return (
    hours * 60 +
    minutes
  );
}

function minutesToTime(
  value
) {
  const hours =
    Math.floor(
      value / 60
    );

  const minutes =
    value % 60;

  return (
    `${String(hours).padStart(
      2,
      "0"
    )}:${String(minutes).padStart(
      2,
      "0"
    )}`
  );
}

export function parseBookingDate(
  value
) {
  const dateKey =
    parseSalonDate(
      value,
      {
        field: "date",
      }
    );

  /*
   * Keep the historic return type:
   * parseBookingDate() returns Date.
   *
   * Noon is deliberately used because
   * it is safely inside the requested
   * salon calendar date and avoids
   * midnight boundary confusion.
   */
  return combineSalonDateAndTime(
    dateKey,
    "12:00",
    {
      dateField: "date",
      timeField: "time",
      rejectAmbiguous: false,
    }
  );
}

function dateAtMinutes(
  dateValue,
  minutes
) {
  const dateKey =
    toSalonDateKey(
      dateValue,
      {
        field: "date",
      }
    );

  return combineSalonDateAndTime(
    dateKey,
    minutesToTime(
      minutes
    ),
    {
      dateField: "date",
      timeField: "time",
    }
  );
}

function appointmentInterval(
  appointment
) {
  let start;

  if (
    appointment?.startsAt
  ) {
    start =
      new Date(
        appointment.startsAt
      );
  } else if (
    appointment?.appointmentDate &&
    appointment?.appointmentTime
  ) {
    start =
      combineSalonDateAndTime(
        appointment.appointmentDate,
        appointment.appointmentTime,
        {
          dateField:
            "appointmentDate",
          timeField:
            "appointmentTime",
        }
      );
  } else {
    start =
      new Date(
        appointment?.appointmentDate
      );
  }

  if (
    Number.isNaN(
      start.getTime()
    )
  ) {
    return null;
  }

  const suppliedEnd =
    appointment?.endsAt
      ? new Date(
          appointment.endsAt
        )
      : null;

  const end =
    suppliedEnd &&
    !Number.isNaN(
      suppliedEnd.getTime()
    )
      ? suppliedEnd
      : new Date(
          start.getTime() +
            Math.max(
              1,
              Number(
                appointment?.duration
              ) || 60
            ) *
              60000
        );

  return {
    start,
    end,
  };
}

function timeOffInterval(
  entry
) {
  const start =
    new Date(
      entry?.startsAt
    );

  const end =
    new Date(
      entry?.endsAt
    );

  if (
    Number.isNaN(
      start.getTime()
    ) ||
    Number.isNaN(
      end.getTime()
    )
  ) {
    return null;
  }

  return {
    start,
    end,
  };
}

function overlaps(
  left,
  right
) {
  return (
    left.start <
      right.end &&
    left.end >
      right.start
  );
}

export function buildAvailableSlots({
  date,
  ranges = [],
  appointments = [],
  timeOff = [],
  duration,
  interval = 30,
  now = new Date(),
}) {
  const targetDateKey =
    toSalonDateKey(
      date,
      {
        field: "date",
      }
    );

  const serviceDuration =
    Number(duration);

  const slotInterval =
    Number(interval);

  if (
    !Number.isInteger(
      serviceDuration
    ) ||
    serviceDuration < 1 ||
    serviceDuration > 1440
  ) {
    throw createValidationError(
      "duration must be between 1 and 1440 minutes.",
      "duration"
    );
  }

  if (
    !Number.isInteger(
      slotInterval
    ) ||
    slotInterval < 5 ||
    slotInterval > 120
  ) {
    throw createValidationError(
      "interval must be between 5 and 120 minutes.",
      "interval"
    );
  }

  const blockedIntervals = [
    ...appointments
      .filter(
        (appointment) =>
          ![
            "cancelled",
            "no_show",
          ].includes(
            appointment?.status
          )
      )
      .map(
        appointmentInterval
      ),

    ...timeOff.map(
      timeOffInterval
    ),
  ].filter(Boolean);

  const slots = [];

  for (
    const range of ranges
  ) {
    const rangeStart =
      timeToMinutes(
        range?.start,
        "range.start"
      );

    const rangeEnd =
      timeToMinutes(
        range?.end,
        "range.end"
      );

    if (
      rangeEnd <=
      rangeStart
    ) {
      continue;
    }

    for (
      let startMinutes =
        rangeStart;

      startMinutes +
          serviceDuration <=
        rangeEnd;

      startMinutes +=
        slotInterval
    ) {
      let candidate;

      try {
        candidate = {
          start:
            dateAtMinutes(
              targetDateKey,
              startMinutes
            ),

          end:
            dateAtMinutes(
              targetDateKey,
              startMinutes +
                serviceDuration
            ),
        };
      } catch (error) {
        /*
         * A DST transition can make a
         * wall-clock value nonexistent
         * or ambiguous. Such a slot
         * must never be offered.
         */
        if (
          error?.statusCode ===
          400
        ) {
          continue;
        }

        throw error;
      }

      if (
        candidate.start <=
        now
      ) {
        continue;
      }

      if (
        blockedIntervals.some(
          (blocked) =>
            overlaps(
              candidate,
              blocked
            )
        )
      ) {
        continue;
      }

      slots.push(
        minutesToTime(
          startMinutes
        )
      );
    }
  }

  return [
    ...new Set(slots),
  ].sort();
}

export function stylistOffersService(
  stylist,
  serviceId
) {
  if (!serviceId) {
    return true;
  }

  if (
    !Array.isArray(
      stylist?.services
    ) ||
    stylist.services.length ===
      0
  ) {
    return true;
  }

  const requestedId =
    String(serviceId);

  return stylist.services.some(
    (service) => {
      const offeredId =
        service?._id ||
        service;

      return (
        String(offeredId) ===
        requestedId
      );
    }
  );
}

export default {
  buildAvailableSlots,
  parseBookingDate,
  stylistOffersService,
};
