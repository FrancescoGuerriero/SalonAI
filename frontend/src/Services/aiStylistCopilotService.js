import API from "../api/axios.js";

export async function getAiStylistCopilot(appointmentId) {
  const safeId = String(appointmentId || "").trim();
  if (!safeId) {
    throw new Error("An appointment is required for Stylist Copilot.");
  }

  const response = await API.get(
    `/ai/stylist-copilot/appointments/${encodeURIComponent(safeId)}`
  );
  return response.data;
}

export default { getAiStylistCopilot };
