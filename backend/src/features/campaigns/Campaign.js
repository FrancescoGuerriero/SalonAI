import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    campaignType: {
      type: String,
      enum: [
        "dormant_customer",
        "appointment_reminder",
        "follow_up",
        "promotion",
        "birthday",
        "general",
      ],
      default: "general",
      index: true,
    },
    channel: {
      type: String,
      enum: ["email", "sms", "whatsapp", "phone", "in_app"],
      required: true,
      index: true,
    },
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommunicationTemplate",
    },
    segment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerSegment",
    },
    recipients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
      },
    ],
    subject: {
      type: String,
      trim: true,
      default: "",
      maxlength: 250,
    },
    message: {
      type: String,
      required: true,
      maxlength: 10000,
    },
    status: {
      type: String,
      enum: [
        "draft",
        "scheduled",
        "processing",
        "completed",
        "partially_failed",
        "failed",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    scheduledFor: {
      type: Date,
      index: true,
    },
    startedAt: Date,
    completedAt: Date,
    recipientCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    sentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

campaignSchema.index({
  status: 1,
  scheduledFor: 1,
});

const Campaign =
  mongoose.models.Campaign ||
  mongoose.model("Campaign", campaignSchema);

export default Campaign;
