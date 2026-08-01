import mongoose from "mongoose";

const schema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: String, required: true },
  bodyHtml: { type: String, required: true },
  audience: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ["draft", "scheduled", "sending", "sent", "cancelled"], default: "draft" },
  scheduledFor: Date,
  metrics: {
    queued: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
  },
}, { timestamps: true });

export default mongoose.models.EmailCampaign || mongoose.model("EmailCampaign", schema);
