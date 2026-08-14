import {
  confirmDemoAppointmentPayment,
  createAppointmentCheckout,
} from "./appointmentPaymentService.js";

export async function createCheckout(request, response) {
  const result = await createAppointmentCheckout(
    request.params.id,
    request.body || {},
    request.user || null
  );

  return response.status(201).json({
    success: true,
    message: result.reused
      ? "Existing appointment payment checkout reused."
      : "Appointment payment checkout created successfully.",
    ...result,
  });
}

export async function confirmDemoPayment(request, response) {
  const result = await confirmDemoAppointmentPayment(
    request.params.id,
    request.params.paymentId
  );

  return response.status(200).json({
    success: true,
    message: "Demo appointment payment confirmed successfully.",
    ...result,
  });
}

export default {
  confirmDemoPayment,
  createCheckout,
};
