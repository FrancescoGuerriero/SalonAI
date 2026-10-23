import {
  createServiceError,
} from "../../shared/serviceError.js";
import {
  recordDomainEvent,
} from "../integrationPlatform/webhookProjectionService.js";
import {
  createManagedAppointment,
} from "./appointmentManagementService.js";
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
  createQueueAppointment,
  createWalkInAppointment,
  frontDeskState,
  listFrontDeskQueue,
  listWalkInQueue,
  queueProjection,
  recordQueueVisitCreated,
};

export default {
  createQueueAppointment,
  createWalkInAppointment,
  listFrontDeskQueue,
  listWalkInQueue,
};
