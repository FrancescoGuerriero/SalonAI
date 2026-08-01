import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const api = axios.create({
  baseURL: `${API_URL}/future`,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token") ||
    localStorage.getItem("salonai_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

function data(response) {
  return response.data;
}

export const templatesApi = {
  list: (params) =>
    api.get("/templates", { params }).then(data),
  get: (id) =>
    api.get(`/templates/${id}`).then(data),
  create: (payload) =>
    api.post("/templates", payload).then(data),
  update: (id, payload) =>
    api.patch(`/templates/${id}`, payload).then(data),
  archive: (id) =>
    api.patch(`/templates/${id}/archive`).then(data),
  preview: (id, context) =>
    api
      .post(`/templates/${id}/preview`, {
        context,
      })
      .then(data),
};

export const segmentsApi = {
  list: (params) =>
    api.get("/segments", { params }).then(data),
  get: (id) =>
    api.get(`/segments/${id}`).then(data),
  create: (payload) =>
    api.post("/segments", payload).then(data),
  update: (id, payload) =>
    api.patch(`/segments/${id}`, payload).then(data),
  remove: (id) =>
    api.delete(`/segments/${id}`).then(data),
  preview: (id, params) =>
    api
      .get(`/segments/${id}/preview`, {
        params,
      })
      .then(data),
};

export const campaignsApi = {
  list: (params) =>
    api.get("/campaigns", { params }).then(data),
  get: (id) =>
    api.get(`/campaigns/${id}`).then(data),
  create: (payload) =>
    api.post("/campaigns", payload).then(data),
  update: (id, payload) =>
    api.patch(`/campaigns/${id}`, payload).then(data),
  preview: (id) =>
    api.get(`/campaigns/${id}/preview`).then(data),
  jobs: (id, params) =>
    api
      .get(`/campaigns/${id}/jobs`, {
        params,
      })
      .then(data),
  schedule: (id, scheduledFor) =>
    api
      .post(`/campaigns/${id}/schedule`, {
        scheduledFor,
      })
      .then(data),
  cancel: (id) =>
    api.post(`/campaigns/${id}/cancel`).then(data),
};

export const schedulerApi = {
  list: (params) =>
    api.get("/scheduler", { params }).then(data),
  process: (limit = 25) =>
    api
      .post("/scheduler/process", { limit })
      .then(data),
  cancel: (id) =>
    api.post(`/scheduler/${id}/cancel`).then(data),
};

export const customerProfilesApi = {
  get: (customerId) =>
    api
      .get(`/customer-profiles/${customerId}`)
      .then(data),
  createNote: (customerId, payload) =>
    api
      .post(
        `/customer-profiles/${customerId}/notes`,
        payload
      )
      .then(data),
  updateNote: (noteId, payload) =>
    api
      .patch(
        `/customer-profiles/notes/${noteId}`,
        payload
      )
      .then(data),
  deleteNote: (noteId) =>
    api
      .delete(
        `/customer-profiles/notes/${noteId}`
      )
      .then(data),
  listTags: () =>
    api.get("/customer-profiles/tags").then(data),
  createTag: (payload) =>
    api
      .post("/customer-profiles/tags", payload)
      .then(data),
  assignTag: (customerId, tagId) =>
    api
      .post(
        `/customer-profiles/${customerId}/tags`,
        { tagId }
      )
      .then(data),
  removeTag: (customerId, tagId) =>
    api
      .delete(
        `/customer-profiles/${customerId}/tags/${tagId}`
      )
      .then(data),
};

export const retentionActionsApi = {
  dormant: (params) =>
    api
      .get("/retention-actions/dormant", {
        params,
      })
      .then(data),
  queueDormant: (payload) =>
    api
      .post(
        "/retention-actions/dormant/queue",
        payload
      )
      .then(data),
  queueFollowUps: (payload) =>
    api
      .post(
        "/retention-actions/follow-ups/queue",
        payload
      )
      .then(data),
};

export const appointmentManagementApi = {
  calendar: (params) =>
    api
      .get("/appointment-management/calendar", {
        params,
      })
      .then(data),
  reschedule: (id, payload) =>
    api
      .patch(
        `/appointment-management/${id}/reschedule`,
        payload
      )
      .then(data),
  updateStatus: (id, payload) =>
    api
      .patch(
        `/appointment-management/${id}/status`,
        payload
      )
      .then(data),
  queueReminder: (id, payload) =>
    api
      .post(
        `/appointment-management/${id}/reminder`,
        payload
      )
      .then(data),
  queueUpcomingReminders: (payload) =>
    api
      .post(
        "/appointment-management/queue-reminders",
        payload
      )
      .then(data),
};

export const waitlistApi = {
  list: (params) =>
    api.get("/waitlist", { params }).then(data),
  create: (payload) =>
    api.post("/waitlist", payload).then(data),
  update: (id, payload) =>
    api.patch(`/waitlist/${id}`, payload).then(data),
  remove: (id) =>
    api.delete(`/waitlist/${id}`).then(data),
  matches: (params) =>
    api
      .get("/waitlist/matches", { params })
      .then(data),
  convert: (id, payload) =>
    api
      .post(`/waitlist/${id}/convert`, payload)
      .then(data),
};

export const aiApi = {
  retention: (customerId) =>
    api
      .post(`/ai/customers/${customerId}/retention`)
      .then(data),
  campaignCopy: (payload) =>
    api.post("/ai/campaign-copy", payload).then(data),
  forecast: (payload) =>
    api
      .post("/ai/revenue-forecast", payload)
      .then(data),
  latestForecast: () =>
    api.get("/ai/revenue-forecast").then(data),
};

export const reportsApi = {
  summary: (params) =>
    api.get("/reports/summary", { params }).then(data),
  downloadUrl: (type, params = {}) => {
    const query = new URLSearchParams(params);
    return `${API_URL}/future/reports/${type}?${query}`;
  },
};

export const loyaltyApi = {
  account: (customerId) =>
    api
      .get(`/loyalty/accounts/${customerId}`)
      .then(data),
  transact: (customerId, payload) =>
    api
      .post(
        `/loyalty/accounts/${customerId}/transactions`,
        payload
      )
      .then(data),
  memberships: (params) =>
    api
      .get("/loyalty/memberships", { params })
      .then(data),
  createMembership: (payload) =>
    api
      .post("/loyalty/memberships", payload)
      .then(data),
  updateMembership: (id, payload) =>
    api
      .patch(`/loyalty/memberships/${id}`, payload)
      .then(data),
};

export const staffApi = {
  week: (staffId) =>
    api
      .get(`/staff/${staffId}/availability`)
      .then(data),
  setAvailability: (staffId, payload) =>
    api
      .put(`/staff/${staffId}/availability`, payload)
      .then(data),
  day: (staffId, date) =>
    api
      .get(`/staff/${staffId}/day`, {
        params: { date },
      })
      .then(data),
  requestTimeOff: (staffId, payload) =>
    api
      .post(`/staff/${staffId}/time-off`, payload)
      .then(data),
  listTimeOff: (params) =>
    api.get("/staff/time-off", { params }).then(data),
  updateTimeOff: (id, status) =>
    api
      .patch(`/staff/time-off/${id}`, { status })
      .then(data),
};

export const securityApi = {
  permissions: () =>
    api.get("/security/permissions").then(data),
  auditLogs: (params) =>
    api
      .get("/security/audit-logs", { params })
      .then(data),
};

export default api;
