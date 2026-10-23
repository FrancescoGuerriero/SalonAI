import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
  {
    reviewId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    profile: { type: Schema.Types.ObjectId, ref: "CustomerExperienceProfile", required: true, index: true },
    business: { type: Schema.Types.ObjectId, ref: "Business", default: undefined, index: true },
    responseText: { type: String, trim: true, maxlength: 2000, default: "" },
    responseStatus: {
      type: String,
      enum: ["none", "draft", "published", "withdrawn"],
      default: "none",
      index: true,
    },
    moderationNote: { type: String, trim: true, maxlength: 1000, default: "" },
    moderatedAt: { type: Date, default: null },
    moderatedBy: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
    respondedAt: { type: Date, default: null },
    respondedBy: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
  },
  { timestamps: true, optimisticConcurrency: true }
);

export default mongoose.models.ReputationResponse ||
  mongoose.model("ReputationResponse", schema);
