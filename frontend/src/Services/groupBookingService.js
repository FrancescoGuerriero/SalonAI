import API from "../api/axios.js";

const BASE_URL = "/future/group-bookings";

function data(response) {
  return response.data;
}

const groupBookingService = {
  list(params = {}) {
    return API.get(BASE_URL, { params }).then(data);
  },

  get(id) {
    return API.get(`${BASE_URL}/${id}`).then(data);
  },

  create(payload) {
    return API.post(BASE_URL, payload).then(data);
  },

  addParticipant(id, payload) {
    return API.post(`${BASE_URL}/${id}/participants`, payload).then(data);
  },

  rescheduleParticipant(id, participantId, payload) {
    return API.patch(
      `${BASE_URL}/${id}/participants/${participantId}/reschedule`,
      payload
    ).then(data);
  },

  updateParticipantStatus(id, participantId, payload) {
    return API.patch(
      `${BASE_URL}/${id}/participants/${participantId}/status`,
      payload
    ).then(data);
  },

  updateGroupStatus(id, payload) {
    return API.patch(`${BASE_URL}/${id}/status`, payload).then(data);
  },
};

export default groupBookingService;
