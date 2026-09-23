import API from "../api/axios.js";

const BASE_URL = "/future/service-trials";

function data(response) {
  return response.data;
}

const serviceTrialService = {
  listDefinitions(params = {}) {
    return API.get(`${BASE_URL}/definitions`, { params }).then(data);
  },

  createDefinition(payload) {
    return API.post(`${BASE_URL}/definitions`, payload).then(data);
  },

  updateDefinition(id, payload) {
    return API.patch(`${BASE_URL}/definitions/${id}`, payload).then(data);
  },

  listBookings(params = {}) {
    return API.get(`${BASE_URL}/bookings`, { params }).then(data);
  },

  getBooking(id) {
    return API.get(`${BASE_URL}/bookings/${id}`).then(data);
  },

  book(payload) {
    return API.post(`${BASE_URL}/bookings`, payload).then(data);
  },

  recordConversion(id, appointment) {
    return API.post(`${BASE_URL}/bookings/${id}/conversion`, {
      appointment,
    }).then(data);
  },
};

export default serviceTrialService;
