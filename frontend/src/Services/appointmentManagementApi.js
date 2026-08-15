import API from "../api/axios.js";

const BASE_URL =
  "/future/appointment-management";

function responseData(response) {
  return response.data;
}

export function getAppointmentCalendar(
  params = {}
) {
  return API.get(
    `${BASE_URL}/calendar`,
    { params }
  ).then(responseData);
}

export function getAppointmentSummary(
  params = {}
) {
  return API.get(
    `${BASE_URL}/summary`,
    { params }
  ).then(responseData);
}

export function getManagedAppointment(
  appointmentId
) {
  return API.get(
    `${BASE_URL}/${appointmentId}`
  ).then(responseData);
}

export function checkAppointmentConflict(
  payload
) {
  return API.post(
    `${BASE_URL}/conflict`,
    payload
  ).then(responseData);
}

export function rescheduleAppointment(
  appointmentId,
  payload
) {
  return API.patch(
    `${BASE_URL}/${appointmentId}/reschedule`,
    payload
  ).then(responseData);
}

export function updateAppointmentStatus(
  appointmentId,
  payload
) {
  return API.patch(
    `${BASE_URL}/${appointmentId}/status`,
    payload
  ).then(responseData);
}

export function bulkUpdateAppointmentStatus(
  payload
) {
  return API.patch(
    `${BASE_URL}/bulk/status`,
    payload
  ).then(responseData);
}

export function queueAppointmentReminder(
  appointmentId,
  payload
) {
  return API.post(
    `${BASE_URL}/${appointmentId}/reminder`,
    payload
  ).then(responseData);
}

export function sendAppointmentReminderNow(
  appointmentId,
  payload = {}
) {
  return API.post(
    `${BASE_URL}/${appointmentId}/communications/reminder`,
    payload
  ).then(responseData);
}

export function getAppointmentCommunicationHistory(
  appointmentId,
  params = {}
) {
  return API.get(
    `${BASE_URL}/${appointmentId}/communications`,
    { params }
  ).then(responseData);
}

export function createAppointmentPaymentCheckout(
  appointmentId,
  payload = {}
) {
  return API.post(
    `${BASE_URL}/${appointmentId}/payments/checkout`,
    payload
  ).then(responseData);
}

export function confirmDemoAppointmentPayment(
  appointmentId,
  paymentId
) {
  return API.post(
    `${BASE_URL}/${appointmentId}/payments/${paymentId}/confirm-demo`
  ).then(responseData);
}

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

  sendReminderNow:
    sendAppointmentReminderNow,

  getCommunicationHistory:
    getAppointmentCommunicationHistory,

  createPaymentCheckout:
    createAppointmentPaymentCheckout,

  confirmDemoPayment:
    confirmDemoAppointmentPayment,

  queueUpcomingReminders:
    queueUpcomingAppointmentReminders,
};

export default appointmentManagementApi;