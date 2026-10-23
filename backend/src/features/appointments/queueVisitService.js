import Appointment from "../../models/Appointment.js";
import {
  salonDayBounds,
} from "../../shared/salonTime.js";
import {
  createServiceError,
} from "../../shared/serviceError.js";
import QueueVisit, {
  QUEUE_VISIT_SOURCES,
} from "./QueueVisit.js";

const TERMINAL_QUEUE_STATES =
  new Set([
    "completed",
    "cancelled",
    "no_show",
  ]);

const APPOINTMENT_POPULATE_OPTIONS = [
  {
    path: "customer",
    select:
      "firstName lastName fullName preferredName name email phone",
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
];

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

function normaliseQueueSource(
  value,
  fallback = "walk_in"
) {
  const source =
    normaliseText(
      value || fallback
    )
      .toLowerCase()
      .replaceAll("-", "_");

  if (
    !QUEUE_VISIT_SOURCES.includes(
      source
    )
  ) {
    throw createServiceError(
      `Queue source must be one of: ${QUEUE_VISIT_SOURCES.join(
        ", "
      )}.`,
      400,
      {
        field: "queueSource",
      }
    );
  }

  return source;
}

function queueStateFromAppointmentStatus(
  status
) {
  switch (
    normaliseText(status)
      .toLowerCase()
      .replaceAll("-", "_")
  ) {
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

    case "pending":
    default:
      return "waiting";
  }
}

function asObject(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value.toObject ===
    "function"
  ) {
    return value.toObject({
      virtuals: true,
    });
  }

  if (
    typeof value.toJSON ===
    "function"
  ) {
    return value.toJSON();
  }

  return {
    ...value,
  };
}

function dateOrNull(value) {
  if (!value) {
    return null;
  }

  const parsed =
    new Date(value);

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}

function minutesBetween(
  startValue,
  endValue
) {
  const start =
    dateOrNull(startValue);
  const end =
    dateOrNull(endValue);

  if (!start || !end) {
    return null;
  }

  return Math.max(
    0,
    Math.round(
      (end.getTime() -
        start.getTime()) /
        60000
    )
  );
}

function queueVisitMetrics(
  appointment,
  visit,
  now = new Date()
) {
  const queuedAt =
    dateOrNull(
      visit?.joinedAt ||
        appointment?.createdAt
    );

  const expectedArrivalAt =
    dateOrNull(
      visit?.expectedArrivalAt ||
        appointment?.startsAt
    );

  const checkedInAt =
    dateOrNull(
      appointment?.checkedInAt
    );

  const startedAt =
    dateOrNull(
      appointment?.startedAt
    );

  const completedAt =
    dateOrNull(
      appointment?.completedAt
    );

  const terminalAt =
    completedAt ||
    dateOrNull(
      appointment?.cancelledAt
    ) ||
    dateOrNull(
      appointment?.noShowAt
    );

  const waitEnd =
    checkedInAt ||
    startedAt ||
    terminalAt ||
    now;

  return {
    waitMinutes:
      minutesBetween(
        queuedAt,
        waitEnd
      ),

    arrivalVarianceMinutes:
      expectedArrivalAt &&
      checkedInAt
        ? Math.round(
            (checkedInAt.getTime() -
              expectedArrivalAt.getTime()) /
              60000
          )
        : null,

    serviceDelayMinutes:
      minutesBetween(
        checkedInAt,
        startedAt
      ),

    visitMinutes:
      minutesBetween(
        checkedInAt ||
          queuedAt,
        completedAt
      ),
  };
}

function queueProjection(
  appointmentValue,
  visitValue = null,
  queuePosition = null,
  now = new Date()
) {
  const appointment =
    asObject(
      appointmentValue
    ) || {};

  const visit =
    asObject(
      visitValue
    );

  const queueSource =
    visit?.source ||
    (
      appointment.bookingSource ===
      "walk_in"
        ? "walk_in"
        : "call_ahead"
    );

  const joinedAt =
    visit?.joinedAt ||
    appointment.createdAt ||
    appointment.startsAt ||
    appointment.appointmentDate;

  return {
    ...appointment,

    queueVisitId:
      visit?._id || null,

    queueSource,

    queueState:
      queueStateFromAppointmentStatus(
        appointment.status
      ),

    queuePosition,

    queuedAt:
      joinedAt,

    joinedAt,

    expectedArrivalAt:
      visit?.expectedArrivalAt ||
      appointment.startsAt ||
      null,

    queuePriority:
      Number(
        visit?.priority || 0
      ),

    partySize:
      Number(
        visit?.partySize || 1
      ),

    queueNotes:
      visit?.notes || "",

    queueMetrics:
      queueVisitMetrics(
        appointment,
        visit,
        now
      ),
  };
}

function summariseQueue(
  items = []
) {
  const bySource = {
    walk_in: 0,
    call_ahead: 0,
  };

  const byState = {};

  let totalWaitMinutes = 0;
  let measuredWaits = 0;
  let longestWaitMinutes = 0;

  for (
    const item of items
  ) {
    const source =
      item.queueSource ||
      "walk_in";

    bySource[source] =
      Number(
        bySource[source] || 0
      ) + 1;

    const state =
      item.queueState ||
      "waiting";

    byState[state] =
      Number(
        byState[state] || 0
      ) + 1;

    const wait =
      Number(
        item.queueMetrics
          ?.waitMinutes
      );

    if (
      Number.isFinite(wait)
    ) {
      totalWaitMinutes +=
        wait;

      measuredWaits += 1;

      longestWaitMinutes =
        Math.max(
          longestWaitMinutes,
          wait
        );
    }
  }

  return {
    total:
      items.length,

    active:
      items.filter(
        (item) =>
          !TERMINAL_QUEUE_STATES.has(
            item.queueState
          )
      ).length,

    bySource,
    byState,

    averageWaitMinutes:
      measuredWaits > 0
        ? Math.round(
            totalWaitMinutes /
              measuredWaits
          )
        : 0,

    longestWaitMinutes,
  };
}

async function createQueueVisitForAppointment(
  appointmentValue,
  {
    source = "walk_in",
    actor = null,
    expectedArrivalAt = null,
    priority = 0,
    partySize = 1,
    notes = "",
  } = {}
) {
  const appointment =
    asObject(
      appointmentValue
    );

  if (!appointment?._id) {
    throw createServiceError(
      "A canonical appointment is required before a queue visit can be created.",
      400
    );
  }

  const queueSource =
    normaliseQueueSource(
      source
    );

  const actorId =
    actor?._id ||
    actor?.id ||
    null;

  const expected =
    dateOrNull(
      expectedArrivalAt ||
        appointment.startsAt
    );

  const visit =
    await QueueVisit.findOneAndUpdate(
      {
        appointment:
          appointment._id,
      },
      {
        $set: {
          business:
            appointment.business ||
            undefined,

          location:
            appointment.location ||
            undefined,

          source:
            queueSource,

          expectedArrivalAt:
            expected,

          priority:
            Math.max(
              -100,
              Math.min(
                100,
                Number(
                  priority
                ) || 0
              )
            ),

          partySize:
            Math.max(
              1,
              Math.min(
                100,
                Math.round(
                  Number(
                    partySize
                  ) || 1
                )
              )
            ),

          notes:
            normaliseText(
              notes
            ),

          updatedBy:
            actorId,
        },

        $setOnInsert: {
          joinedAt:
            appointment.createdAt ||
            new Date(),

          createdBy:
            actorId,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert:
          true,
      }
    ).lean({
      virtuals: true,
    });

  return queueProjection(
    appointment,
    visit,
    null
  );
}

async function listQueueVisits(
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

  const requestedSource =
    normaliseText(
      query.source ||
        query.queueSource
    );

  const source =
    requestedSource
      ? normaliseQueueSource(
          requestedSource
        )
      : null;

  const visitMatch = {
    $or: [
      {
        expectedArrivalAt: {
          $gte: start,
          $lte: end,
        },
      },
      {
        expectedArrivalAt:
          null,

        joinedAt: {
          $gte: start,
          $lte: end,
        },
      },
    ],
  };

  if (source) {
    visitMatch.source =
      source;
  }

  const visits =
    await QueueVisit.find(
      visitMatch
    )
      .populate({
        path: "appointment",
        populate:
          APPOINTMENT_POPULATE_OPTIONS,
      })
      .sort({
        priority: -1,
        expectedArrivalAt: 1,
        joinedAt: 1,
        _id: 1,
      })
      .lean({
        virtuals: true,
      });

  const now =
    new Date();

  const projections =
    visits
      .filter(
        (visit) =>
          visit.appointment
      )
      .map(
        (visit) =>
          queueProjection(
            visit.appointment,
            visit,
            null,
            now
          )
      );

  const knownAppointmentIds =
    new Set(
      projections
        .map(
          (item) =>
            String(
              item._id || ""
            )
        )
        .filter(Boolean)
    );

  if (
    !source ||
    source === "walk_in"
  ) {
    const legacyAppointments =
      await Appointment.find({
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
      })
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

    for (
      const appointment of
      legacyAppointments
    ) {
      if (
        knownAppointmentIds.has(
          String(
            appointment._id
          )
        )
      ) {
        continue;
      }

      projections.push(
        queueProjection(
          appointment,
          null,
          null,
          now
        )
      );
    }
  }

  const filtered =
    projections
      .filter(
        (item) =>
          includeTerminal ||
          !TERMINAL_QUEUE_STATES.has(
            item.queueState
          )
      )
      .sort(
        (
          left,
          right
        ) => {
          const priorityDiff =
            Number(
              right.queuePriority ||
                0
            ) -
            Number(
              left.queuePriority ||
                0
            );

          if (
            priorityDiff !== 0
          ) {
            return priorityDiff;
          }

          const leftTime =
            dateOrNull(
              left.expectedArrivalAt ||
                left.queuedAt
            )?.getTime() || 0;

          const rightTime =
            dateOrNull(
              right.expectedArrivalAt ||
                right.queuedAt
            )?.getTime() || 0;

          if (
            leftTime !== rightTime
          ) {
            return (
              leftTime -
              rightTime
            );
          }

          return String(
            left._id || ""
          ).localeCompare(
            String(
              right._id || ""
            )
          );
        }
      );

  let position = 0;

  const items =
    filtered.map(
      (item) => {
        if (
          TERMINAL_QUEUE_STATES.has(
            item.queueState
          )
        ) {
          return {
            ...item,
            queuePosition:
              null,
          };
        }

        position += 1;

        return {
          ...item,
          queuePosition:
            position,
        };
      }
    );

  return {
    items,
    metrics:
      summariseQueue(
        items
      ),
  };
}

export {
  TERMINAL_QUEUE_STATES,
  createQueueVisitForAppointment,
  listQueueVisits,
  normaliseQueueSource,
  queueProjection,
  queueStateFromAppointmentStatus,
  queueVisitMetrics,
  summariseQueue,
};

export default {
  createQueueVisitForAppointment,
  listQueueVisits,
};
