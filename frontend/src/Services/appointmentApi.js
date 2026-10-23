import API from "../api/axios.js";

const ENDPOINT = "/appointments";

/**
 * Return the authenticated customer's appointments.
 */
export function getAppointments(params = {}) {
  return API.get(ENDPOINT, { params });
}

/**
 * Create an appointment for the authenticated customer.
 */
export function createAppointment(data) {
  return API.post(ENDPOINT, data);
}

/**
 * Persist the authenticated customer's current booking selections for
 * server-side abandonment detection. Business ownership is never supplied
 * by the browser; it is derived from canonical customer state when available.
 */
export function saveBookingRecoveryIntent(data = {}) {
  return API.post(`${ENDPOINT}/recovery/intents`, data);
}

export function getBookingRecoveryIntent(token) {
  return API.get(`${ENDPOINT}/recovery/${encodeURIComponent(token)}`);
}

export function resumeBookingRecoveryIntent(token) {
  return API.post(
    `${ENDPOINT}/recovery/${encodeURIComponent(token)}/resume`
  );
}

export function attributeBookingRecoveryAppointment(token, appointmentId) {
  return API.post(
    `${ENDPOINT}/recovery/${encodeURIComponent(token)}/attribute-appointment`,
    { appointmentId }
  );
}

/**
 * Create or reuse a secure Stripe Checkout session for an appointment.
 * Purpose may be "deposit" or "balance".
 */
export function createAppointmentPaymentCheckout(
  appointmentId,
  data = {}
) {
  return API.post(
    `${ENDPOINT}/${appointmentId}/payments/checkout`,
    data
  );
}
