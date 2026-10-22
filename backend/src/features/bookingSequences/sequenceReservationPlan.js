import {
  combineSalonDateAndTime,
  toSalonDateKey,
} from "../../shared/salonTime.js";
import {
  buildServiceSequenceTimeline,
  normaliseServiceSequence,
} from "./serviceSequenceFeasibility.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function planError(message, code, field) {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  error.statusCode = 400;
  error.details = field ? { field } : undefined;
  return error;
}

function timeToMinutes(value) {
  const time = String(value || "").trim();
  if (!TIME_PATTERN.test(time)) {
    throw planError(
      "Sequence booking time must use HH:mm format.",
      "INVALID_SEQUENCE_BOOKING_TIME",
      "appointmentTime"
    );
  }
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function resourceKey(kind, key) {
  return `${String(kind || "").trim()}:${String(key || "").trim().toLowerCase()}`;
}

function segmentWindow(dateKey, segment) {
  return Object.freeze({
    segmentOrder: segment.order,
    startsAt: combineSalonDateAndTime(
      dateKey,
      minutesToTime(segment.startMinutes),
      { dateField: "appointmentDate", timeField: "appointmentTime" }
    ),
    endsAt: combineSalonDateAndTime(
      dateKey,
      minutesToTime(segment.endMinutes),
      { dateField: "appointmentDate", timeField: "appointmentTime" }
    ),
  });
}

export function buildSequenceReservationPlan({
  sequence,
  date,
  startTime,
  resources = [],
} = {}) {
  const contract = normaliseServiceSequence(sequence);
  const dateKey = toSalonDateKey(date, { field: "appointmentDate" });
  const startMinutes = timeToMinutes(startTime);
  const timeline = buildServiceSequenceTimeline(sequence, startMinutes);

  if (timeline.endMinutes > 1439) {
    throw planError(
      "A service sequence must finish before the end of the salon calendar day.",
      "SEQUENCE_CROSSES_CALENDAR_DAY",
      "serviceSequence"
    );
  }

  const providerWindows = timeline.segments
    .filter((segment) => segment.providerRequired)
    .map((segment) => segmentWindow(dateKey, segment));

  if (providerWindows.length === 0) {
    throw planError(
      "A sequenced appointment requires at least one provider-required service segment.",
      "SEQUENCE_PROVIDER_SEGMENT_REQUIRED",
      "serviceSequence"
    );
  }

  const resourceMap = new Map(
    (Array.isArray(resources) ? resources : []).map((resource) => [
      resourceKey(resource?.kind, resource?.key),
      resource,
    ])
  );

  const reservations = [];

  for (const segment of timeline.segments) {
    for (const requirement of segment.resourceRequirements) {
      const key = resourceKey(requirement.kind, requirement.resourceKey);
      const resource = resourceMap.get(key);

      if (!resource || resource.active === false) {
        throw planError(
          `Required booking resource ${key} is not available at this location.`,
          "BOOKING_RESOURCE_NOT_FOUND",
          "serviceSequence"
        );
      }

      const capacity = Math.max(1, Number(resource.capacity) || 1);
      const quantity = requirement.exclusive
        ? capacity
        : Number(requirement.quantity) || 1;

      if (quantity > capacity) {
        throw planError(
          `Required booking resource ${key} does not have enough capacity.`,
          "BOOKING_RESOURCE_CAPACITY_EXCEEDED",
          "serviceSequence"
        );
      }

      const window = segmentWindow(dateKey, segment);
      reservations.push(
        Object.freeze({
          resourceId: String(resource._id || resource.id || "").trim(),
          kind: requirement.kind,
          resourceKey: String(requirement.resourceKey).trim().toLowerCase(),
          segmentOrder: segment.order,
          segmentType: segment.type,
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          quantity,
        })
      );
    }
  }

  return Object.freeze({
    contract,
    dateKey,
    startTime: minutesToTime(startMinutes),
    endTime: minutesToTime(timeline.endMinutes),
    startsAt: combineSalonDateAndTime(dateKey, minutesToTime(startMinutes), {
      dateField: "appointmentDate",
      timeField: "appointmentTime",
    }),
    endsAt: combineSalonDateAndTime(dateKey, minutesToTime(timeline.endMinutes), {
      dateField: "appointmentDate",
      timeField: "appointmentTime",
    }),
    totalDurationMinutes: timeline.totalDurationMinutes,
    providerWindows: Object.freeze(providerWindows),
    reservations: Object.freeze(reservations),
  });
}

export default {
  buildSequenceReservationPlan,
};
