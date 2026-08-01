import API from "../api/axios.js";

const BASE_URL = "/future/staff-rota";

function responseData(response) {
  return response.data?.data || response.data;
}

export async function getStaffRota(params = {}) {
  const response = await API.get(`${BASE_URL}/week`, {
    params,
  });

  return responseData(response);
}

export async function createStaffShift(payload) {
  const response = await API.post(
    `${BASE_URL}/shifts`,
    payload
  );

  return responseData(response);
}

export async function updateStaffShift(shiftId, payload) {
  const response = await API.patch(
    `${BASE_URL}/shifts/${shiftId}`,
    payload
  );

  return responseData(response);
}

export async function deleteStaffShift(shiftId) {
  const response = await API.delete(
    `${BASE_URL}/shifts/${shiftId}`
  );

  return responseData(response);
}

export async function publishStaffRotaWeek(startDate) {
  const response = await API.post(
    `${BASE_URL}/weeks/publish`,
    { startDate }
  );

  return responseData(response);
}

export async function clockInStaffShift(
  shiftId,
  payload = {}
) {
  const response = await API.post(
    `${BASE_URL}/shifts/${shiftId}/clock-in`,
    payload
  );

  return responseData(response);
}

export async function clockOutStaffShift(
  shiftId,
  payload = {}
) {
  const response = await API.post(
    `${BASE_URL}/shifts/${shiftId}/clock-out`,
    payload
  );

  return responseData(response);
}

export async function updateStaffAttendance(
  shiftId,
  payload
) {
  const response = await API.patch(
    `${BASE_URL}/shifts/${shiftId}/attendance`,
    payload
  );

  return responseData(response);
}

const staffRotaApi = {
  clockIn: clockInStaffShift,
  clockOut: clockOutStaffShift,
  createShift: createStaffShift,
  deleteShift: deleteStaffShift,
  getWeek: getStaffRota,
  publishWeek: publishStaffRotaWeek,
  updateAttendance: updateStaffAttendance,
  updateShift: updateStaffShift,
};

export default staffRotaApi;
