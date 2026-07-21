import api from "./api";

/*
|--------------------------------------------------------------------------
| Appointment API
|--------------------------------------------------------------------------
*/

/**
 * Get appointments
 * Supports optional filters:
 *  - page
 *  - limit
 *  - stylist
 *  - customer
 *  - status
 *  - from
 *  - to
 */
export function getAppointments(params = {}) {
  return api.get("/appointments", {
    params,
  });
}

/**
 * Get one appointment
 */
export function getAppointment(id) {
  return api.get(`/appointments/${id}`);
}

/**
 * Create appointment
 */
export function createAppointment(data) {
  return api.post("/appointments", data);
}

/**
 * Update appointment
 */
export function updateAppointment(id, data) {
  return api.put(`/appointments/${id}`, data);
}

/**
 * Delete appointment
 */
export function deleteAppointment(id) {
  return api.delete(`/appointments/${id}`);
}

/**
 * Move appointment
 */
export function moveAppointment(id, startTime, endTime) {
  return api.patch(`/appointments/${id}/move`, {
    startTime,
    endTime,
  });
}

/**
 * Confirm appointment
 */
export function confirmAppointment(id) {
  return api.patch(`/appointments/${id}/confirm`);
}

/**
 * Check in customer
 */
export function checkInAppointment(id) {
  return api.patch(`/appointments/${id}/check-in`);
}

/**
 * Mark appointment in progress
 */
export function startAppointment(id) {
  return api.patch(`/appointments/${id}/start`);
}

/**
 * Complete appointment
 */
export function completeAppointment(id) {
  return api.patch(`/appointments/${id}/complete`);
}

/**
 * Cancel appointment
 */
export function cancelAppointment(id, reason = "") {
  return api.patch(`/appointments/${id}/cancel`, {
    reason,
  });
}

/**
 * Check stylist availability
 */
export function checkAvailability(data) {
  return api.post("/appointments/check-availability", data);
}