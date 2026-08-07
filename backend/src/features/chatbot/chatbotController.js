import Service from "../../models/service.js";
import Stylist from "../../models/Stylist.js";
import {
  buildChatbotResponse,
  validateChatbotMessage,
} from "./chatbotService.js";

export async function sendChatbotMessage(request, response, next) {
  try {
    const message = validateChatbotMessage(
      request.body?.message
    );

    const [services, stylists] = await Promise.all([
      Service.find({ active: { $ne: false } })
        .select("name category description price duration")
        .sort({ category: 1, name: 1 })
        .limit(12)
        .lean(),
      Stylist.find({ isActive: { $ne: false } })
        .select("firstName lastName specialties rating")
        .sort({ firstName: 1, lastName: 1 })
        .limit(12)
        .lean(),
    ]);

    const result = buildChatbotResponse({
      message,
      services,
      stylists,
    });

    return response.status(200).json({
      success: true,
      assistant: result,
    });
  } catch (error) {
    return next(error);
  }
}

export default {
  sendChatbotMessage,
};
