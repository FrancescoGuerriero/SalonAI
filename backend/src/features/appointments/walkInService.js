import {
  createServiceError,
} from "../../shared/serviceError.js";
import {
  recordDomainEvent,
} from "../integrationPlatform/webhookProjectionService.js";
import {
  changeAppointmentStatus,
  createManagedAppointment,
  getManagedAppointment,
} from "./appointmentManagementService.js";
import QueueVisit from "./QueueVisit.js";
import {
  createQueueVisitForAppointment,
  listQueueVisits,
  normaliseQueueSource,
  queueProjection,
  queueStateFromAppointmentStatus,
} from "./queueVisitService.js";

function normaliseText(value) {
  return String(
    value ?? ""
  ).trim();
}

function normaliseStatus(value) {
  return normaliseText(value)
    .toLowerCase()
    .replaceAll("-", "_");
}

function identifier(value) {
  return normaliseText(
    value?._id ||
      value?.id ||
      value
  );
}

function frontDeskState(
  status
) {
  return queueStateFromAppointmentStatus(
    status
  );
}

async function recordQueueVisitCreated(
  appointment,
  queueVisit,
  actor = null
) {
  const businessId =
    identifier(
      queueVisit?.business ||
        appointment?.business
    );

  const queueVisitId =
    identifier(
      queueVisit?.queueVisitId
    );

  if (
    !businessId ||
    !queueVisitId
  ) {
    return null;
  }

  return recordDomainEvent({
    businessId,
    type: "queue.visit_created",
    version: "1",
    aggregateType:
      "queue_visit",
    aggregateId:
      queueVisitId,
    payload: {
      queueVisitId,
      appointmentId:
        identifier(
          appointment?._id
        ),
      locationId:
        identifier(
          queueVisit?.location ||
            appointment?.location
        ),
      source:
        queueVisit?.queueSource ||
        "walk_in",
      state:
        queueVisit?.queueState ||
        frontDeskState(
          appointment?.status
        ),
      expectedArrivalAt:
        queueVisit?.expectedArrivalAt ||
        null,
      priority:
        Number(
          queueVisit?.queuePriority ||
            0
        ),
      partySize:
        Number(
          queueVisit?.partySize ||
            1
        ),
    },
    source: "front_desk",
    correlationId:
      identifier(
        appointment?._id
      ),
    metadata: {
      actorId:
        identifier(actor),
    },
  });
}

async function recordQueueStatusTransition(
  appointment,
  queueVisit,
  previousStatus,
  actor = null
) {
  const appointmentId =
    identifier(
      appointment?._id
    );

  const queueVisitId =
    identifier(
      queueVisit?._id ||
        queueVisit?.queueVisitId
    );

  const businessId =
    identifier(
      queueVisit?.business ||
        appointment?.business
    );

  if (
    !appointmentId ||
    !queueVisitId ||
    !businessId
  ) {
    return [];
  }

  const currentStatus =
    normaliseStatus(
      appointment?.status
    );

  const safePreviousStatus =
    normaliseStatus(
      previousStatus
    );

  if (
    !currentStatus ||
    currentStatus ===
      safePreviousStatus
  ) {
    return [];
  }

  const previousState =
    frontDeskState(
      safePreviousStatus
    );

  const state =
    frontDeskState(
      currentStatus
    );

  if (
    previousState === state
  ) {
    return [];
  }

  const common = {
    businessId,
    version: "1",
    aggregateType:
      "queue_visit",
    aggregateId:
      queueVisitId,
    source: "front_desk",
    correlationId:
      appointmentId,
    metadata: {
      actorId:
        identifier(actor),
    },
  };

  const payload = {
    queueVisitId,
    appointmentId,
    locationId:
      identifier(
        queueVisit?.location ||
          appointment?.location
      ),
    source:
      queueVisit?.source ||
      queueVisit?.queueSource ||
      "walk_in",
    previousStatus:
      safePreviousStatus,
    status:
      currentStatus,
    previousState,
    state,
  };

  const events = [];

  if (
    state === "checked_in"
  ) {
    events.push(
      await recordDomainEvent({
        ...common,
        type:
          "queue.checked_in",
        payload,
      })
    );
  }

  events.push(
    await recordDomainEvent({
      ...common,
      type:
        "queue.state_changed",
      payload,
    })
  );

  return events.filter(Boolean);
}

async function changeQueueVisitStatusIfPresent(
  appointmentId,
  status,
  details = {},
  {
    actor = null,
  } = {}
) {
  const id =
    identifier(
      appointmentId
    );

  if (!id) {
    throw createServiceError(
      "An appointment identifier is required.",
      400,
      {
        field:
          "appointmentId",
      }
    );
  }

  const queueVisit =
    await QueueVisit.findOne({
      appointment: id,
    }).lean({
      virtuals: true,
    });

  if (!queueVisit) {
    return null;
  }

  const before =
    await getManagedAppointment(
      id
    );

  const previousStatus =
    before?.status;

  const appointment =
    await changeAppointmentStatus(
      id,
      status,
      details,
      {
        actor,
      }
    );

  await recordQueueStatusTransition(
    appointment,
    queueVisit,
    previousStatus,
    actor
  );

  return appointment;
}

async function createQueueAppointment(
  payload = {},
  {
    actor = null,
    source = null,
  } = {}
) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw createServiceError(
      "Queue appointment details are required.",
      400
    );
  }

  const queueSource =
    normaliseQueueSource(
      source ||
        payload.queueSource ||
        payload.arrivalSource ||
        "walk_in"
    );

  const appointment =
    await createManagedAppointment(
      {
        ...payload,
        status: "pending",
      },
      {
        actor,

        bookingSource:
          queueSource ===
          "walk_in"
            ? "walk_in"
            : "phone",
      }
    );

  const queueVisit =
    await createQueueVisitForAppointment(
      appointment,
      {
        source:
          queueSource,
        actor,

        expectedArrivalAt:
          payload.expectedArrivalAt ||
          payload.startsAt ||
          appointment.startsAt,

        priority:
          payload.priority,

        partySize:
          payload.partySize,

        notes:
          normaliseText(
            payload.queueNotes ||
              payload.notes
          ),
      }
    );

  await recordQueueVisitCreated(
    appointment,
    queueVisit,
    actor
  );

  return queueVisit;
}

async function createWalkInAppointment(
  payload = {},
  {
    actor = null,
  } = {}
) {
  return createQueueAppointment(
    payload,
    {
      actor,
      source:
        "walk_in",
    }
  );
}

async function listFrontDeskQueue(
  query = {}
) {
  return listQueueVisits(
    query
  );
}

async function listWalkInQueue(
  query = {}
) {
  const {
    items,
  } =
    await listQueueVisits({
      ...query,
      source:
        "walk_in",
    });

  return items;
}

export {
  changeQueueVisitStatusIfPresent,
  createQueueAppointment,
  createWalkInAppointment,
  frontDeskState,
  listFrontDeskQueue,
  listWalkInQueue,
  queueProjection,
  recordQueueStatusTransition,
  recordQueueVisitCreated,
};

export default {
  changeQueueVisitStatusIfPresent,
  createQueueAppointment,
  createWalkInAppointment,
  listFrontDeskQueue,
  listWalkInQueue,
};
