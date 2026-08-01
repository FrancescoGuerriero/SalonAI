import WhatsAppConversation from "./WhatsAppConversation.js";

export async function listConversations(req, res) {
  res.json({ success: true, conversations: await WhatsAppConversation.find().sort({ lastMessageAt: -1 }).lean() });
}

export async function webhook(req, res) {
  const conversation = await WhatsAppConversation.findOneAndUpdate(
    { phone: req.body.phone },
    {
      $set: { lastMessageAt: new Date() },
      $push: { messages: { direction: "inbound", body: req.body.body, providerMessageId: req.body.providerMessageId } },
    },
    { new: true, upsert: true }
  );
  res.json({ success: true, conversationId: conversation._id });
}

export async function confirmBooking(req, res) {
  const conversation = await WhatsAppConversation.findById(req.params.conversationId);
  conversation.bookingSession.confirmed = true;
  conversation.status = "completed";
  await conversation.save();
  res.json({ success: true, bookingSession: conversation.bookingSession });
}
