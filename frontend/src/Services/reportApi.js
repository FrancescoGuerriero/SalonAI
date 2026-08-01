import API from "../api/axios.js";

const BASE_URL = "/future/reports";

function responseData(response) {
  return response.data;
}

/**
 * Retrieve the management report summary.
 */
export function getReportSummary(params = {}) {
  return API.get(`${BASE_URL}/summary`, {
    params,
  }).then(responseData);
}

/**
 * Download a report through the authenticated API.
 */
export function downloadReport(
  reportType,
  params = {}
) {
  return API.get(
    `${BASE_URL}/${reportType}`,
    {
      params,
      responseType: "blob",
    }
  );
}

const reportApi = {
  getSummary: getReportSummary,
  download: downloadReport,
};

export default reportApi;