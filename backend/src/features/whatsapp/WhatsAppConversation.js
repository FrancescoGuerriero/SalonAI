import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  direction: { type: String, enum: ["inbound", "outbound"], required: true },
  body: String,
  providerMessageId: String,
  sentAt: { type: Date, default: Date.now },
}, { _id: true });

const schema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  phone: { type: String, required: true, index: true },
  status: { type: String, enum: ["open", "awaiting_confirmation", "completed", "closed"], default: "open" },
  bookingSession: {
    serviceId: mongoose.Schema.Types.ObjectId,
    stylistId: mongoose.Schema.Types.ObjectId,
    appointmentDate: Date,
    price: Number,
    confirmed: { type: Boolean, default: false },
  },
  messages: { type: [messageSchema], default: [] },
  lastMessageAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.models.WhatsAppConversation || mongoose.model("WhatsAppConversation", schema);
