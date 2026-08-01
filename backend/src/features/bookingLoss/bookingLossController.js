import {
  generateBookingLossAnalytics,
} from "./bookingLossService.js";

function readQueryValue(request, key) {
  const value = request.query?.[key];
  return Array.isArray(value) ? value[0] : value;
}

async function getBookingLossAnalytics(request, response) {
  const analytics = await generateBookingLossAnalytics({
    months: readQueryValue(request, "months"),
  });

  return response.status(200).json({
    success: true,
    analytics,
  });
}

export { getBookingLossAnalytics };
