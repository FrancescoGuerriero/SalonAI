import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
  {
    period: { type: String, enum: ["minute", "day"], required: true, index: true },
    bucket: { type: String, required: true, trim: true, maxlength: 40, index: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

schema.index({ period: 1, bucket: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.WindsorApiUsageBudget || mongoose.model("WindsorApiUsageBudget", schema);
