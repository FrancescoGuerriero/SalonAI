import {
  createServiceError,
} from "../../shared/serviceError.js";
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

function frontDeskState(
  status
) {
  return queueStateFromAppointmentStatus(
    status
  );
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

  return createQueueVisitForAppointment(
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
};

export default {
  createQueueAppointment,
  createWalkInAppointment,
  listFrontDeskQueue,
  listWalkInQueue,
};
