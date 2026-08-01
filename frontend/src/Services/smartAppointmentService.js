import API from "../api/axios.js";

async function getSmartAppointmentRecommendations(params = {}) {
  const response = await API.get("/future/smart-appointments", { params });
  return response.data;
}

export { getSmartAppointmentRecommendations };
