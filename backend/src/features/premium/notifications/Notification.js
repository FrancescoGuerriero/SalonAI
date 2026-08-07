import mongoose from "mongoose";

const schema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  channel: { type: String, enum: ["email", "sms", "push", "whatsapp", "in_app"], required: true },
  recipient: { type: String, required: true },
  subject: String,
  body: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ["queued", "scheduled", "sending", "sent", "failed", "cancelled"], default: "queued" },
  scheduledFor: Date,
  sentAt: Date,
  readAt: { type: Date, default: null },
  attempts: { type: Number, default: 0 },
  lastError: String,
  idempotencyKey: { type: String, unique: true, sparse: true },
}, { timestamps: true });

export default mongoose.models.Notification || mongoose.model("Notification", schema);
