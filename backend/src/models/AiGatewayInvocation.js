import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    location: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    toolKey: { type: String, required: true, trim: true, maxlength: 120, index: true },
    requestedAction: {
      type: String,
      enum: ["analyse", "summarise", "forecast", "recommend"],
      required: true,
      index: true,
    },
    registryVersion: { type: String, trim: true, maxlength: 40, default: "" },
    evidenceId: { type: String, required: true, trim: true, maxlength: 64, index: true },
    evidenceContract: { type: String, required: true, trim: true, maxlength: 120 },
    evidenceChecksum: { type: String, required: true, trim: true, maxlength: 64 },
    factCount: { type: Number, min: 0, default: 0 },
    provenanceCount: { type: Number, min: 0, default: 0 },
    sourceSummary: {
      type: [{ sourceId: { type: String, maxlength: 240 }, provider: { type: String, maxlength: 80 } }],
      default: () => [],
    },
    status: {
      type: String,
      enum: ["planned", "rejected", "failed"],
      default: "planned",
      index: true,
    },
    planOutcome: { type: Schema.Types.Mixed, default: () => ({}) },
    humanApprovalRequired: { type: Boolean, default: true },
    executionAuthorised: { type: Boolean, default: false },
    externalWriteAuthorised: { type: Boolean, default: false },
    inferenceExecuted: { type: Boolean, default: false },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

schema.index({ business: 1, location: 1, createdAt: -1 });
schema.index({ business: 1, location: 1, toolKey: 1, createdAt: -1 });
schema.index({ business: 1, location: 1, evidenceId: 1, createdAt: -1 });

export default mongoose.models.AiGatewayInvocation || mongoose.model("AiGatewayInvocation", schema);
