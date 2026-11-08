import mongoose from "mongoose";

const quotaSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true,
    index: true,
  },
  toolKey: {
    type: String,
    required: true,
    enum: ["business.metrics.read"],
  },
  periodStart: {
    type: Date,
    required: true,
  },
  admittedCount: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
}, { timestamps: true });

quotaSchema.index(
  { business: 1, toolKey: 1, periodStart: 1 },
  { unique: true, name: "unique_ai_monthly_business_tool_quota" },
);

const AiToolMonthlyUsage = mongoose.models.AiToolMonthlyUsage ||
  mongoose.model("AiToolMonthlyUsage", quotaSchema);

export default AiToolMonthlyUsage;
