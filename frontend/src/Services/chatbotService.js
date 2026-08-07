import API from "../api/axios.js";

export async function sendChatbotMessage(message) {
  const response = await API.post("/chatbot/message", {
    message,
  });

  return response.data?.assistant;
}

export default {
  sendChatbotMessage,
};
