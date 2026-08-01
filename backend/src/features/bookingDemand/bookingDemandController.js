import {
  generateBookingDemandAnalytics,
} from "./bookingDemandService.js";

function readQueryValue(
  request,
  key
) {
  const value =
    request.query?.[key];

  return Array.isArray(value)
    ? value[0]
    : value;
}

async function getBookingDemandAnalytics(
  request,
  response
) {
  const analytics =
    await generateBookingDemandAnalytics({
      months:
        readQueryValue(
          request,
          "months"
        ),
    });

  return response
    .status(200)
    .json({
      success: true,
      analytics,
    });
}

export {
  getBookingDemandAnalytics,
};