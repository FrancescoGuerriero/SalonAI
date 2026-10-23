import {
  createQueueAppointment,
  createWalkInAppointment,
  listFrontDeskQueue,
  listWalkInQueue,
} from "./walkInService.js";

function serialise(value) {
  if (!value) {
    return value;
  }

  if (
    typeof value.toJSON ===
    "function"
  ) {
    return value.toJSON();
  }

  if (
    typeof value.toObject ===
    "function"
  ) {
    return value.toObject();
  }

  return value;
}

async function createWalkIn(
  request,
  response
) {
  const appointment =
    await createWalkInAppointment(
      request.body || {},
      {
        actor:
          request.user || null,
      }
    );

  return response
    .status(201)
    .json({
      success: true,
      message:
        "Walk-in added to the front-desk queue.",
      appointment:
        serialise(
          appointment
        ),
    });
}

async function walkInQueue(
  request,
  response
) {
  const items =
    await listWalkInQueue(
      request.query || {}
    );

  return response
    .status(200)
    .json({
      success: true,
      message:
        "Walk-in queue retrieved successfully.",
      items:
        items.map(
          serialise
        ),
      total:
        items.length,
    });
}

async function createQueueVisit(
  request,
  response
) {
  const appointment =
    await createQueueAppointment(
      request.body || {},
      {
        actor:
          request.user || null,

        source:
          request.body
            ?.queueSource ||
          request.body
            ?.arrivalSource ||
          null,
      }
    );

  return response
    .status(201)
    .json({
      success: true,
      message:
        "Queue visit created successfully.",
      appointment:
        serialise(
          appointment
        ),
    });
}

async function queueVisits(
  request,
  response
) {
  const {
    items,
    metrics,
  } =
    await listFrontDeskQueue(
      request.query || {}
    );

  return response
    .status(200)
    .json({
      success: true,
      message:
        "Front-desk queue retrieved successfully.",
      items:
        items.map(
          serialise
        ),
      total:
        items.length,
      metrics,
    });
}

export {
  createQueueVisit,
  createWalkIn,
  queueVisits,
  walkInQueue,
};

export default {
  createQueueVisit,
  createWalkIn,
  queueVisits,
  walkInQueue,
};
