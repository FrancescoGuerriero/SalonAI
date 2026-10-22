import {
  combineSalonDateAndTime,
  toSalonDateKey,
} from "../../shared/salonTime.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const TERMINAL_APPOINTMENT_STATUSES = new Set(["cancelled", "no_show"]);

function validationError(message, field) {
  const error = new Error(message);
  error.statusCode = 400;
  error.status = 400;
  error.details = { field };
  return error;
}

function timeToMinutes(value, field) {
  const time = String(value || "").trim();
  if (!TIME_PATTERN.test(time)) {
    throw validationError(`${field} must use HH:mm format.`, field);
  }
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function asPositiveInteger(value, field, { min = 1, max = 1440 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw validationError(
      `${field} must be an integer between ${min} and ${max}.`,
      field
    );
  }
  return number;
}

function normaliseRequirement(requirement, index) {
  const kind = String(requirement?.kind || "").trim();
  const resourceKey = String(requirement?.resourceKey || "").trim();

  if (!["chair", "room", "equipment"].includes(kind)) {
    throw validationError(
      `steps.resourceRequirements[${index}].kind is unsupported.`,
      "steps.resourceRequirements.kind"
    );
  }

  if (!resourceKey) {
    throw validationError(
      "A resource requirement needs resourceKey.",
      "steps.resourceRequirements.resourceKey"
    );
  }

  return Object.freeze({
    kind,
    resourceKey,
    quantity: asPositiveInteger(
      requirement?.quantity ?? 1,
      "steps.resourceRequirements.quantity",
      { min: 1, max: 100 }
    ),
    exclusive: requirement?.exclusive !== false,
  });
}

export function normaliseServiceSequence(sequence = {}) {
  const steps = Array.isArray(sequence?.steps) ? sequence.steps : [];

  if (steps.length === 0) {
    throw validationError(
      "A service sequence requires at least one step.",
      "steps"
    );
  }

  const normalised = steps
    .map((step, index) => {
      const order = Number.isInteger(Number(step?.order))
        ? Number(step.order)
        : index;

      return Object.freeze({
        order,
        serviceId: String(step?.service?._id || step?.service || "").trim(),
        label: String(step?.label || "").trim(),
        durationMinutes: asPositiveInteger(
          step?.durationMinutes ?? step?.duration,
          "steps.durationMinutes"
        ),
        providerRequired: step?.providerRequired !== false,
        processingGapAfterMinutes: asPositiveInteger(
          step?.processingGapAfterMinutes ?? 0,
          "steps.processingGapAfterMinutes",
          { min: 0, max: 1440 }
        ),
        holdResourcesDuringGap: step?.holdResourcesDuringGap === true,
        resourceRequirements: Object.freeze(
          (Array.isArray(step?.resourceRequirements)
            ? step.resourceRequirements
            : []
          ).map(normaliseRequirement)
        ),
      });
    })
    .sort((left, right) => left.order - right.order);

  const orderValues = normalised.map((step) => step.order);
  if (new Set(orderValues).size !== orderValues.length) {
    throw validationError(
      "Service sequence step order values must be unique.",
      "steps.order"
    );
  }

  const totalDurationMinutes = normalised.reduce(
    (total, step) =>
      total + step.durationMinutes + step.processingGapAfterMinutes,
    0
  );

  if (totalDurationMinutes > 1440) {
    throw validationError(
      "A service sequence cannot exceed 24 hours.",
      "steps"
    );
  }

  return Object.freeze({
    id: String(sequence?._id || sequence?.id || "").trim(),
    primaryServiceId: String(
      sequence?.primaryService?._id || sequence?.primaryService || ""
    ).trim(),
    steps: Object.freeze(normalised),
    totalDurationMinutes,
  });
}

export function buildServiceSequenceTimeline(sequence, startMinutes = 0) {
  const contract = normaliseServiceSequence(sequence);
  let cursor = Number(startMinutes);

  if (!Number.isInteger(cursor) || cursor < 0 || cursor > 1439) {
    throw validationError(
      "startMinutes must be a valid minute-of-day value.",
      "startMinutes"
    );
  }

  const segments = [];

  for (const step of contract.steps) {
    const activeStart = cursor;
    const activeEnd = activeStart + step.durationMinutes;
    const gapEnd = activeEnd + step.processingGapAfterMinutes;

    segments.push(
      Object.freeze({
        type: "service",
        order: step.order,
        serviceId: step.serviceId,
        label: step.label,
        startMinutes: activeStart,
        endMinutes: activeEnd,
        providerRequired: step.providerRequired,
        resourceRequirements: step.resourceRequirements,
      })
    );

    if (step.processingGapAfterMinutes > 0) {
      segments.push(
        Object.freeze({
          type: "processing_gap",
          order: step.order,
          serviceId: step.serviceId,
          label: step.label,
          startMinutes: activeEnd,
          endMinutes: gapEnd,
          providerRequired: false,
          resourceRequirements: step.holdResourcesDuringGap
            ? step.resourceRequirements
            : Object.freeze([]),
        })
      );
    }

    cursor = gapEnd;
  }

  return Object.freeze({
    startMinutes,
    endMinutes: cursor,
    totalDurationMinutes: cursor - startMinutes,
    segments: Object.freeze(segments),
  });
}

function intervalFromAppointment(appointment) {
  if (TERMINAL_APPOINTMENT_STATUSES.has(appointment?.status)) return null;

  const start = appointment?.startsAt
    ? new Date(appointment.startsAt)
    : null;
  const end = appointment?.endsAt
    ? new Date(appointment.endsAt)
    : start
      ? new Date(
          start.getTime() +
            Math.max(1, Number(appointment?.duration) || 60) * 60000
        )
      : null;

  if (
    !start ||
    !end ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return null;
  }

  return { start, end, quantity: 1 };
}

function intervalFromBusy(entry) {
  const start = new Date(entry?.startsAt);
  const end = new Date(entry?.endsAt);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return null;
  }

  return {
    start,
    end,
    quantity: Math.max(1, Number(entry?.quantity) || 1),
  };
}

function overlaps(left, right) {
  return left.start < right.end && left.end > right.start;
}

function maxConcurrentQuantity(candidate, busyEntries) {
  const events = [];

  for (const entry of busyEntries) {
    if (!overlaps(candidate, entry)) continue;

    const start = Math.max(candidate.start.getTime(), entry.start.getTime());
    const end = Math.min(candidate.end.getTime(), entry.end.getTime());

    events.push([start, entry.quantity]);
    events.push([end, -entry.quantity]);
  }

  events.sort((left, right) => {
    if (left[0] !== right[0]) return left[0] - right[0];
    return left[1] - right[1];
  });

  let current = 0;
  let maximum = 0;

  for (const [, delta] of events) {
    current += delta;
    maximum = Math.max(maximum, current);
  }

  return maximum;
}

function dateInterval(dateKey, startMinutes, endMinutes) {
  return {
    start: combineSalonDateAndTime(dateKey, minutesToTime(startMinutes), {
      dateField: "date",
      timeField: "time",
    }),
    end: combineSalonDateAndTime(dateKey, minutesToTime(endMinutes), {
      dateField: "date",
      timeField: "time",
    }),
  };
}

function resourceKey(requirement) {
  return `${requirement.kind}:${requirement.resourceKey}`;
}

function resourceAvailable(interval, requirement, resources) {
  const entry = resources?.[resourceKey(requirement)];
  if (!entry) return false;

  const capacity = Math.max(1, Number(entry.capacity) || 1);
  const required = requirement.exclusive
    ? capacity
    : requirement.quantity;

  if (required > capacity) return false;

  const busy = (Array.isArray(entry.busy) ? entry.busy : [])
    .map(intervalFromBusy)
    .filter(Boolean);

  return maxConcurrentQuantity(interval, busy) + required <= capacity;
}

export function buildSequenceAvailableSlots({
  date,
  ranges = [],
  sequence,
  providerAppointments = [],
  providerTimeOff = [],
  resources = {},
  interval = 30,
  now = new Date(),
}) {
  const contract = normaliseServiceSequence(sequence);
  const dateKey = toSalonDateKey(date, { field: "date" });
  const slotInterval = asPositiveInteger(interval, "interval", {
    min: 5,
    max: 120,
  });

  const providerBusy = [
    ...providerAppointments.map(intervalFromAppointment),
    ...providerTimeOff.map(intervalFromBusy),
  ].filter(Boolean);

  const slots = [];

  for (const range of ranges) {
    const rangeStart = timeToMinutes(range?.start, "range.start");
    const rangeEnd = timeToMinutes(range?.end, "range.end");

    if (rangeEnd <= rangeStart) continue;

    for (
      let candidateStart = rangeStart;
      candidateStart + contract.totalDurationMinutes <= rangeEnd;
      candidateStart += slotInterval
    ) {
      let timeline;

      try {
        timeline = buildServiceSequenceTimeline(sequence, candidateStart);
      } catch (error) {
        if (error?.statusCode === 400) continue;
        throw error;
      }

      let candidateWindow;
      try {
        candidateWindow = dateInterval(
          dateKey,
          timeline.startMinutes,
          timeline.endMinutes
        );
      } catch (error) {
        if (error?.statusCode === 400) continue;
        throw error;
      }

      if (candidateWindow.start <= now) continue;

      let feasible = true;

      for (const segment of timeline.segments) {
        let intervalWindow;

        try {
          intervalWindow = dateInterval(
            dateKey,
            segment.startMinutes,
            segment.endMinutes
          );
        } catch (error) {
          feasible = false;
          break;
        }

        if (
          segment.providerRequired &&
          providerBusy.some((busy) => overlaps(intervalWindow, busy))
        ) {
          feasible = false;
          break;
        }

        for (const requirement of segment.resourceRequirements) {
          if (!resourceAvailable(intervalWindow, requirement, resources)) {
            feasible = false;
            break;
          }
        }

        if (!feasible) break;
      }

      if (feasible) {
        slots.push(minutesToTime(candidateStart));
      }
    }
  }

  return [...new Set(slots)].sort();
}

export default {
  buildSequenceAvailableSlots,
  buildServiceSequenceTimeline,
  normaliseServiceSequence,
};
