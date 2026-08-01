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
