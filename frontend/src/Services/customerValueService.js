import API from "../api/axios.js";

const BASE_URL =
  "/future/customer-value";

function clampInteger(
  value,
  minimum,
  maximum,
  fallback
) {
  const parsedValue =
    Number.parseInt(value, 10);

  if (
    !Number.isFinite(parsedValue)
  ) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      parsedValue
    )
  );
}

async function getCustomerValueAnalytics({
  months = 12,
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
              12
            ),
        },
      }
    );

  return response.data;
}

const customerValueService = {
  getCustomerValueAnalytics,
};

export {
  getCustomerValueAnalytics,
};

export default customerValueService;