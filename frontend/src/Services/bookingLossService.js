import API from "../api/axios.js";

const BASE_URL =
  "/future/booking-loss";

function clampInteger(
  value,
  minimum,
  maximum,
  fallback
) {
  const parsedValue =
    Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, parsedValue)
  );
}

async function getBookingLossAnalytics({
  months = 6,
} = {}) {
  const response =
    await API.get(
      BASE_URL,
      {
        params: {
          months:
            clampInteger(
              months,
              1,
              24,
              6
            ),
        },
      }
    );

  return response.data;
}

const bookingLossService = {
  getBookingLossAnalytics,
};

export {
  getBookingLossAnalytics,
};

export default bookingLossService;