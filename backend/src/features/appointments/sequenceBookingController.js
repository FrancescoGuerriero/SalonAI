import {
  createSequencedManagedAppointment,
} from "../bookingSequences/sequencedAppointmentService.js";

function body(request) {
  return request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? request.body
    : {};
}

function serialise(value) {
  if (!value) return value;
  if (typeof value.toJSON === "function") return value.toJSON();
  if (typeof value.toObject === "function") return value.toObject();
  return value;
}

export async function createSequencedAppointment(request, response) {
  const result = await createSequencedManagedAppointment(body(request), {
    actor: request.user || null,
    bookingSource: "management",
  });

  return response.status(201).json({
    success: true,
    message: "Sequenced appointment created successfully.",
    appointment: serialise(result.appointment),
    serviceSequence: result.serviceSequence,
    providerReservations: result.providerReservations,
    resourceReservations: result.resourceReservations,
  });
}

export default {
  createSequencedAppointment,
};
