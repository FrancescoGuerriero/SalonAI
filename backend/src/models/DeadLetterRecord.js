import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    jobType: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    errorMessage: String,
    attempts: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "retrying", "resolved", "discarded"],
      default: "pending",
      index: true,
    },
    nextRetryAt: Date,
    resolvedAt: Date,
  },
  {
    timestamps: true,
  }
);

export default (
  mongoose.models.DeadLetterRecord ||
  mongoose.model("DeadLetterRecord", schema)
);
