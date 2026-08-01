import {
  generateServicePerformance,
} from "./servicePerformanceService.js";

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

async function getServicePerformance(
  request,
  response
) {
  const analytics =
    await generateServicePerformance({
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
  getServicePerformance,
};