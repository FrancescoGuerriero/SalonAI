import mongoose from "mongoose";

const stepSchema = new mongoose.Schema({
  order: { type: Number, required: true },
  delayMinutes: { type: Number, default: 0 },
  channel: { type: String, enum: ["email", "sms", "push", "whatsapp", "in_app"], required: true },
  subject: String,
  body: { type: String, required: true },
  stopIf: { type: String, enum: ["appointment_booked", "purchase_completed", "customer_opted_out", "none"], default: "none" },
}, { _id: true });

const schema = new mongoose.Schema({
  name: { type: String, required: true },
  trigger: { type: String, enum: ["customer_created", "appointment_completed", "customer_inactive", "loyalty_tier_changed", "referral_rewarded"], required: true },
  enabled: { type: Boolean, default: true },
  conditions: { type: mongoose.Schema.Types.Mixed, default: {} },
  steps: { type: [stepSchema], default: [] },
}, { timestamps: true });

export default mongoose.models.RetentionJourney || mongoose.model("RetentionJourney", schema);
