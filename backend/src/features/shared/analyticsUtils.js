const DAY_MS = 86_400_000;

function clampInteger(value, minimum, maximum, fallback) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsedValue));
}

function roundNumber(value, decimalPlaces = 2) {
  const multiplier = 10 ** decimalPlaces;
  return Math.round((Number(value) || 0) * multiplier) / multiplier;
}

function roundMoney(value) {
  return roundNumber(value, 2);
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }

    const numericValue = Number(value);

    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return 0;
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const numericValue = Number(value);

    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }
  }

  return 0;
}

function toValidDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getAppointmentDate(appointment) {
  const startsAt = toValidDate(appointment?.startsAt);

  if (startsAt) {
    return startsAt;
  }

  const appointmentDate = toValidDate(appointment?.appointmentDate);

  if (!appointmentDate) {
    return null;
  }

  const timeMatch = String(appointment?.appointmentTime || "").match(
    /^(\d{1,2}):(\d{2})/
  );

  if (timeMatch) {
    appointmentDate.setHours(
      Number(timeMatch[1]),
      Number(timeMatch[2]),
      0,
      0
    );
  }

  return appointmentDate;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + Number(days || 0));
  return result;
}

function daysBetween(earlierDate, laterDate) {
  if (!earlierDate || !laterDate) {
    return null;
  }

  return Math.max(
    0,
    Math.floor((laterDate.getTime() - earlierDate.getTime()) / DAY_MS)
  );
}

function startOfUtcMonth(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
  );
}

function addUtcMonths(date, months) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
  );
}

function getEntityId(entity) {
  return String(entity?._id || entity?.id || entity || "").trim();
}

function getEntityName(entity, fallback = "Unknown") {
  const combinedName = [entity?.firstName, entity?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    entity?.name ||
    entity?.fullName ||
    entity?.displayName ||
    combinedName ||
    entity?.title ||
    entity?.email ||
    fallback
  );
}

function getAppointmentValue(appointment) {
  return firstPositiveNumber(
    appointment?.finalPrice,
    appointment?.totalPrice,
    appointment?.price,
    appointment?.service?.price
  );
}

function getAppointmentDuration(appointment, fallback = 60) {
  const duration = firstPositiveNumber(
    appointment?.duration,
    appointment?.service?.duration
  );

  return duration > 0 ? duration : fallback;
}

function normaliseStatus(value, fallback = "pending") {
  return String(value || fallback).trim().toLowerCase();
}

function escapeCsvValue(value) {
  const text = value === null || value === undefined ? "" : String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function recordsToCsv(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return "";
  }

  const headers = Array.from(
    records.reduce((keys, record) => {
      Object.keys(record || {}).forEach((key) => keys.add(key));
      return keys;
    }, new Set())
  );

  const rows = [headers.map(escapeCsvValue).join(",")];

  for (const record of records) {
    rows.push(
      headers
        .map((header) => {
          const value = record?.[header];

          if (value && typeof value === "object") {
            return escapeCsvValue(JSON.stringify(value));
          }

          return escapeCsvValue(value);
        })
        .join(",")
    );
  }

  return rows.join("\r\n");
}

function getRequestActor(request) {
  return {
    userId: getEntityId(request?.user),
    email: request?.user?.email || "",
    role: request?.user?.role || "",
    ipAddress:
      request?.ip ||
      request?.headers?.["x-forwarded-for"] ||
      request?.socket?.remoteAddress ||
      "",
    userAgent: request?.headers?.["user-agent"] || "",
  };
}

export {
  DAY_MS,
  addDays,
  addUtcMonths,
  clampInteger,
  daysBetween,
  escapeCsvValue,
  firstFiniteNumber,
  firstPositiveNumber,
  getAppointmentDate,
  getAppointmentDuration,
  getAppointmentValue,
  getEntityId,
  getEntityName,
  getRequestActor,
  normaliseStatus,
  recordsToCsv,
  roundMoney,
  roundNumber,
  startOfUtcMonth,
  toValidDate,
};
