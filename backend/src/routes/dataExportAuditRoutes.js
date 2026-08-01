import {
  generateCustomerValueAnalytics,
} from "./customerValueService.js";

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

async function getCustomerValueAnalytics(
  request,
  response
) {
  const analytics =
    await generateCustomerValueAnalytics({
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
  getCustomerValueAnalytics,
};