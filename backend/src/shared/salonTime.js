import {
  DateTime,
  IANAZone,
} from "luxon";

export const DEFAULT_SALON_TIME_ZONE =
  "Europe/London";

const DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/;

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

export function getSalonTimeZone() {
  const zone =
    String(
      process.env.SALON_TIME_ZONE ||
        DEFAULT_SALON_TIME_ZONE
    ).trim();

  if (!IANAZone.isValidZone(zone)) {
    const error =
      new Error(
        "SALON_TIME_ZONE must be a valid IANA time zone."
      );

    error.code =
      "INVALID_SALON_TIME_ZONE";

    throw error;
  }

  return zone;
}

export function parseSalonDate(
  value,
  {
    field = "date",
    zone = getSalonTimeZone(),
  } = {}
) {
  const text =
    String(value ?? "").trim();

  if (!DATE_PATTERN.test(text)) {
    throw createValidationError(
      `${field} must use YYYY-MM-DD format.`,
      field
    );
  }

  const candidate =
    DateTime.fromFormat(
      text,
      "yyyy-MM-dd",
      {
        zone,
        setZone: true,
        locale: "en-GB",
      }
    );

  if (
    !candidate.isValid ||
    candidate.toFormat(
      "yyyy-MM-dd"
    ) !== text
  ) {
    throw createValidationError(
      `${field} must be a valid calendar date.`,
      field
    );
  }

  return text;
}

export function parseSalonTime(
  value,
  {
    field = "time",
  } = {}
) {
  const text =
    String(value ?? "").trim();

  if (!TIME_PATTERN.test(text)) {
    throw createValidationError(
      `${field} must use HH:mm format.`,
      field
    );
  }

  return text;
}

export function toSalonDateKey(
  value,
  {
    field = "date",
    zone = getSalonTimeZone(),
  } = {}
) {
  if (
    typeof value === "string" &&
    DATE_PATTERN.test(
      value.trim()
    )
  ) {
    return parseSalonDate(
      value,
      {
        field,
        zone,
      }
    );
  }

  const date =
    value instanceof Date
      ? new Date(
          value.getTime()
        )
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw createValidationError(
      `${field} must be a valid date.`,
      field
    );
  }

  return DateTime
    .fromJSDate(
      date,
      {
        zone,
      }
    )
    .toFormat(
      "yyyy-MM-dd"
    );
}

export function combineSalonDateAndTime(
  dateValue,
  timeValue,
  {
    dateField = "date",
    timeField = "time",
    zone = getSalonTimeZone(),
    rejectAmbiguous = true,
  } = {}
) {
  const dateText =
    toSalonDateKey(
      dateValue,
      {
        field:
          dateField,
        zone,
      }
    );

  const timeText =
    parseSalonTime(
      timeValue,
      {
        field:
          timeField,
      }
    );

  const [
    year,
    month,
    day,
  ] =
    dateText
      .split("-")
      .map(Number);

  const [
    hour,
    minute,
  ] =
    timeText
      .split(":")
      .map(Number);

  const local =
    DateTime.fromObject(
      {
        year,
        month,
        day,
        hour,
        minute,
        second: 0,
        millisecond: 0,
      },
      {
        zone,
      }
    );

  const expected =
    `${dateText} ${timeText}`;

  /*
   * Luxon can normalise a nonexistent
   * DST wall-clock value forward.
   *
   * Example:
   * Europe/London 2026-03-29 01:30
   * does not exist because clocks jump
   * from 01:00 to 02:00.
   *
   * The round-trip comparison detects
   * that normalisation and rejects it.
   */
  if (
    !local.isValid ||
    local.toFormat(
      "yyyy-MM-dd HH:mm"
    ) !== expected
  ) {
    throw createValidationError(
      `${dateField} and ${timeField} do not identify a valid local time in ${zone}.`,
      timeField
    );
  }

  if (
    rejectAmbiguous &&
    typeof local
      .getPossibleOffsets ===
      "function"
  ) {
    const possibleOffsets =
      local
        .getPossibleOffsets();

    if (
      possibleOffsets.length >
      1
    ) {
      throw createValidationError(
        `${timeField} is ambiguous in ${zone} because of a daylight-saving transition.`,
        timeField
      );
    }
  }

  return local
    .toUTC()
    .toJSDate();
}

export function salonDateAnchor(
  value,
  {
    zone = getSalonTimeZone(),
  } = {}
) {
  const dateKey =
    toSalonDateKey(
      value,
      {
        field: "date",
        zone,
      }
    );

  /*
   * appointmentDate is a calendar-day
   * marker, not the appointment instant.
   *
   * Noon is intentionally used because
   * it remains safely within the salon's
   * local calendar date across DST.
   */
  return combineSalonDateAndTime(
    dateKey,
    "12:00",
    {
      dateField: "date",
      timeField: "time",
      zone,
      rejectAmbiguous: false,
    }
  );
}

export function formatSalonTime(
  value,
  {
    zone = getSalonTimeZone(),
  } = {}
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return DateTime
    .fromJSDate(
      date,
      {
        zone,
      }
    )
    .toFormat(
      "HH:mm"
    );
}

export function salonDayOfWeek(
  value,
  {
    zone = getSalonTimeZone(),
  } = {}
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw createValidationError(
      "date must be a valid date.",
      "date"
    );
  }

  /*
   * Luxon:
   * Monday = 1 ... Sunday = 7
   *
   * Existing SalonAI staff data:
   * Sunday = 0 ... Saturday = 6
   */
  return DateTime
    .fromJSDate(
      date,
      {
        zone,
      }
    )
    .weekday % 7;
}

export function salonMinutesSinceMidnight(
  value,
  {
    zone = getSalonTimeZone(),
  } = {}
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw createValidationError(
      "date must be a valid date.",
      "date"
    );
  }

  const local =
    DateTime.fromJSDate(
      date,
      {
        zone,
      }
    );

  return (
    local.hour * 60 +
    local.minute
  );
}

export function sameSalonDay(
  left,
  right,
  options = {}
) {
  return (
    toSalonDateKey(
      left,
      options
    ) ===
    toSalonDateKey(
      right,
      options
    )
  );
}

export function addSalonDays(
  value,
  days,
  {
    zone = getSalonTimeZone(),
  } = {}
) {
  const dateKey =
    toSalonDateKey(
      value,
      {
        zone,
      }
    );

  const nextDateKey =
    DateTime
      .fromISO(
        dateKey,
        {
          zone,
        }
      )
      .plus({
        days:
          Number(days) ||
          0,
      })
      .toFormat(
        "yyyy-MM-dd"
      );

  return combineSalonDateAndTime(
    nextDateKey,
    "12:00",
    {
      zone,
      rejectAmbiguous:
        false,
    }
  );
}

export function salonDayBounds(
  value,
  {
    zone = getSalonTimeZone(),
  } = {}
) {
  const dateKey =
    toSalonDateKey(
      value,
      {
        zone,
      }
    );

  const nextDateKey =
    DateTime
      .fromISO(
        dateKey,
        {
          zone,
        }
      )
      .plus({
        days: 1,
      })
      .toFormat(
        "yyyy-MM-dd"
      );

  const start =
    combineSalonDateAndTime(
      dateKey,
      "00:00",
      {
        zone,
        rejectAmbiguous:
          false,
      }
    );

  const nextStart =
    combineSalonDateAndTime(
      nextDateKey,
      "00:00",
      {
        zone,
        rejectAmbiguous:
          false,
      }
    );

  return {
    start,

    end:
      new Date(
        nextStart.getTime() -
          1
      ),
  };
}

export default {
  DEFAULT_SALON_TIME_ZONE,
  getSalonTimeZone,
  parseSalonDate,
  parseSalonTime,
  toSalonDateKey,
  combineSalonDateAndTime,
  salonDateAnchor,
  formatSalonTime,
  salonDayOfWeek,
  salonMinutesSinceMidnight,
  sameSalonDay,
  addSalonDays,
  salonDayBounds,
};
