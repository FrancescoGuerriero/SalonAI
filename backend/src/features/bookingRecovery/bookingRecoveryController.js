import * as service from "./bookingRecoveryService.js";

function body(request) {
  return request.body &&
    typeof request.body === "object" &&
    !Array.isArray(request.body)
    ? request.body
    : {};
}

export async function saveIntent(request, response) {
  response.json(
    await service.saveBookingRecoveryIntent(body(request), {
      user: request.user,
    })
  );
}

export async function recoveryIntent(request, response) {
  response.json(
    await service.getBookingRecoveryIntent(request.params.token, {
      user: request.user,
    })
  );
}

export async function resumeIntent(request, response) {
  response.json(
    await service.resumeBookingRecoveryIntent(request.params.token, {
      user: request.user,
    })
  );
}

export async function attributeAppointment(request, response) {
  response.json(
    await service.attributeRecoveredAppointment(
      request.params.token,
      body(request).appointmentId,
      { user: request.user }
    )
  );
}

export default {
  attributeAppointment,
  recoveryIntent,
  resumeIntent,
  saveIntent,
};
