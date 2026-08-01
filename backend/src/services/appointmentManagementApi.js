import API from "../api/axios.js";

const BASE_URL =
  "/future/appointment-management";

function responseData(response) {
  return response.data;
}

/**
 * Retrieve appointments for the management calendar.
 */
export function getAppointmentCalendar(
  params = {}
) {
  return API.get(
    `${BASE_URL}/calendar`,
    { params }
  ).then(responseData);
}

/**
 * Retrieve appointment-management totals.
 */
export function getAppointmentSummary(
  params = {}
) {
  return API.get(
    `${BASE_URL}/summary`,
    { params }
  ).then(responseData);
}

/**
 * Retrieve one appointment with populated details.
 */
export function getManagedAppointment(
  appointmentId
) {
  return API.get(
    `${BASE_URL}/${appointmentId}`
  ).then(responseData);
}

/**
 * Check whether a proposed appointment overlaps
 * another booking or violates staff availability.
 */
export function checkAppointmentConflict(
  payload
) {
  return API.post(
    `${BASE_URL}/conflict`,
    payload
  ).then(responseData);
}

/**
 * Reschedule an existing appointment.
 */
export function rescheduleAppointment(
  appointmentId,
  payload
) {
  return API.patch(
    `${BASE_URL}/${appointmentId}/reschedule`,
    payload
  ).then(responseData);
}

/**
 * Change one appointment's operational status.
 */
export function updateAppointmentStatus(
  appointmentId,
  payload
) {
  return API.patch(
    `${BASE_URL}/${appointmentId}/status`,
    payload
  ).then(responseData);
}

/**
 * Change several appointments at once.
 */
export function bulkUpdateAppointmentStatus(
  payload
) {
  return API.patch(
    `${BASE_URL}/bulk/status`,
    payload
  ).then(responseData);
}

/**
 * Queue an email or SMS reminder for one appointment.
 */
export function queueAppointmentReminder(
  appointmentId,
  payload
) {
  return API.post(
    `${BASE_URL}/${appointmentId}/reminder`,
    payload
  ).then(responseData);
}

/**
 * Queue reminders for upcoming appointments.
 */
export function queueUpcomingAppointmentReminders(
  payload = {}
) {
  return API.post(
    `${BASE_URL}/queue-reminders`,
    payload
  ).then(responseData);
}

const appointmentManagementApi = {
  getCalendar:
    getAppointmentCalendar,

  getSummary:
    getAppointmentSummary,

  getById:
    getManagedAppointment,

  checkConflict:
    checkAppointmentConflict,

  reschedule:
    rescheduleAppointment,

  updateStatus:
    updateAppointmentStatus,

  bulkUpdateStatus:
    bulkUpdateAppointmentStatus,

  queueReminder:
    queueAppointmentReminder,

  queueUpcomingReminders:
    queueUpcomingAppointmentReminders,
};

export default appointmentManagementApi;