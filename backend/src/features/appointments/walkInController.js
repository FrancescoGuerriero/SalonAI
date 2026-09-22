import {
  createWalkInAppointment,
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

export {
  createWalkIn,
  walkInQueue,
};

export default {
  createWalkIn,
  walkInQueue,
};
