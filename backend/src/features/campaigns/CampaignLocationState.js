import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    campaign: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "processing", "completed", "cancelled"],
      default: "draft",
      index: true,
    },
    scheduledFor: { type: Date, default: null, index: true },
    recipientCount: { type: Number, min: 0, default: 0 },
    sentCount: { type: Number, min: 0, default: 0 },
    failedCount: { type: Number, min: 0, default: 0 },
    lastScheduledAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

schema.index(
  { business: 1, location: 1, campaign: 1 },
  { unique: true }
);
schema.index({ business: 1, location: 1, status: 1, scheduledFor: 1 });

export default mongoose.models.CampaignLocationState ||
  mongoose.model("CampaignLocationState", schema);
