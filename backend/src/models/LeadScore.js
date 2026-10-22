import mongoose from "mongoose";

const { Schema } = mongoose;

const leadScoreSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    lead: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    band: {
      type: String,
      enum: ["cold", "warm", "hot"],
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: ["rules", "manual", "ai"],
      default: "rules",
      index: true,
    },
    version: {
      type: String,
      trim: true,
      default: "1",
      maxlength: 80,
    },
    factors: {
      type: [
        {
          key: { type: String, trim: true, required: true, maxlength: 120 },
          value: { type: Schema.Types.Mixed, default: null },
          contribution: { type: Number, required: true },
          reason: { type: String, trim: true, default: "", maxlength: 500 },
        },
      ],
      default: [],
    },
    features: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    explanation: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

leadScoreSchema.index({ business: 1, lead: 1, createdAt: -1, _id: -1 });

leadScoreSchema.pre("save", function blockScoreMutation() {
  if (!this.isNew) {
    const error = new Error("Lead score records are immutable snapshots.");
    error.code = "LEAD_SCORE_IMMUTABLE";
    throw error;
  }
});

for (const operation of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "findOneAndReplace",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
]) {
  leadScoreSchema.pre(operation, function blockScoreQueryMutation() {
    const error = new Error("Lead score records are immutable snapshots.");
    error.code = "LEAD_SCORE_IMMUTABLE";
    throw error;
  });
}

export default (
  mongoose.models.LeadScore ||
  mongoose.model("LeadScore", leadScoreSchema)
);
