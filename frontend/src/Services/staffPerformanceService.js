import API from "../api/axios.js";

const BASE_URL = "/future/staff-performance";

function clampInteger(value, minimum, maximum, fallback) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsedValue));
}

async function getStaffPerformance({ months = 6 } = {}) {
  const response = await API.get(BASE_URL, {
    params: {
      months: clampInteger(months, 1, 24, 6),
    },
  });

  return response.data;
}

async function saveStaffCompensationPlan(stylistId, payload) {
  const response = await API.put(
    `${BASE_URL}/stylists/${stylistId}/plan`,
    payload
  );

  return response.data;
}

async function assignRetailOrder(orderId, stylistId, notes = "") {
  const response = await API.patch(
    `${BASE_URL}/retail-orders/${orderId}/assignment`,
    {
      stylistId,
      notes,
    }
  );

  return response.data;
}

async function unassignRetailOrder(orderId) {
  const response = await API.delete(
    `${BASE_URL}/retail-orders/${orderId}/assignment`
  );

  return response.data;
}

const staffPerformanceService = {
  assignRetailOrder,
  getStaffPerformance,
  saveStaffCompensationPlan,
  unassignRetailOrder,
};

export {
  assignRetailOrder,
  getStaffPerformance,
  saveStaffCompensationPlan,
  unassignRetailOrder,
};

export default staffPerformanceService;
