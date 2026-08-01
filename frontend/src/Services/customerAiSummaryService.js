import API from "../api/axios.js";

function createCustomerAiSummaryError(error) {
  const data = error?.response?.data || {};
  const apiError = new Error(
    data.message ||
      error?.message ||
      "The AI customer-summary request failed."
  );

  apiError.name = "CustomerAiSummaryApiError";
  apiError.status = error?.response?.status || null;
  apiError.code =
    data.code ||
    error?.code ||
    "AI_CUSTOMER_SUMMARY_API_ERROR";
  apiError.details = data.details || null;
  apiError.data = data;

  return apiError;
}

export async function generateCustomerAiSummary(
  customerId,
  { style = "detailed" } = {}
) {
  const identifier = String(customerId || "").trim();

  if (!identifier) {
    throw new Error("Select a customer before generating a summary.");
  }

  try {
    const response = await API.get(
      `/ai/customers/${encodeURIComponent(identifier)}/summary`,
      {
        params: {
          style: style === "concise" ? "concise" : "detailed",
        },
      }
    );

    return response.data;
  } catch (error) {
    throw createCustomerAiSummaryError(error);
  }
}

export default {
  generateCustomerAiSummary,
};
