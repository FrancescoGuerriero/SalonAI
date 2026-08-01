import { recommendAppointmentSlots } from "./smartAppointmentService.js";

async function getSmartAppointmentRecommendations(request, response) {
  const analytics = await recommendAppointmentSlots(request.query);
  return response.status(200).json({ success: true, analytics });
}

export { getSmartAppointmentRecommendations };
