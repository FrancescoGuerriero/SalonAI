import API from "../api/axios.js";

const BASE_URL = "/future/data-export-audit";

async function exportDataset(dataset, { format = "csv", months = 12 } = {}) {
  const response = await API.get(`${BASE_URL}/exports/${dataset}`, {
    params: { format, months },
    responseType: "blob",
  });

  const contentDisposition = response.headers?.["content-disposition"] || "";
  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  const filename = filenameMatch?.[1] || `salonai-${dataset}.${format}`;
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return { filename };
}

async function getAuditEvents(params = {}) {
  const response = await API.get(`${BASE_URL}/audit`, { params });
  return response.data;
}

export { exportDataset, getAuditEvents };
