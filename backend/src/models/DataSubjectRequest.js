import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["access", "deletion", "rectification", "restriction"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["submitted", "verified", "in_progress", "completed", "rejected"],
      default: "submitted",
      index: true,
    },
    dueAt: {
      type: Date,
      required: true,
      index: true,
    },
    completedAt: Date,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

export default (
  mongoose.models.DataSubjectRequest ||
  mongoose.model("DataSubjectRequest", schema)
);
