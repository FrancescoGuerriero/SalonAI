import mongoose from "mongoose";

const schema = new mongoose.Schema({
  name: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  trigger: { type: String, enum: ["appointment_created", "before_appointment", "high_no_show_risk", "appointment_changed"], required: true },
  minutesBefore: Number,
  riskLevel: { type: String, enum: ["low", "medium", "high"] },
  template: { type: String, required: true },
  requestConfirmation: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.models.SmsRule || mongoose.model("SmsRule", schema);
