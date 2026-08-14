import mongoose from "mongoose";

const transactionalNotificationEventSchema = new mongoose.Schema(
  {
    eventKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      maxlength: 300,
    },
    event: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
      index: true,
    },
    status: {
      type: String,
      enum: ["processing", "completed", "partial", "failed"],
      default: "processing",
      index: true,
    },
    requestedChannels: {
      type: [String],
      default: [],
    },
    successful: {
      type: Number,
      min: 0,
      default: 0,
    },
    skipped: {
      type: Number,
      min: 0,
      default: 0,
    },
    failed: {
      type: Number,
      min: 0,
      default: 0,
    },
    results: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const TransactionalNotificationEvent =
  mongoose.models.TransactionalNotificationEvent ||
  mongoose.model("TransactionalNotificationEvent", transactionalNotificationEventSchema);

export default TransactionalNotificationEvent;
