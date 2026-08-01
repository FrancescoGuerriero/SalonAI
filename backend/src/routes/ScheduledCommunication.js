import mongoose from "mongoose";

const { Schema } = mongoose;

const recipientSchema = new Schema(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      default: null,
    },
    serviceName: {
      type: String,
      trim: true,
      default: "",
    },
    estimatedRevenue: {
      type: Number,
      min: 0,
      default: 0,
    },
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
    },
    sourceStatus: {
      type: String,
      enum: ["completed", "cancelled", "no_show", "manual"],
      default: "manual",
    },
    status: {
      type: String,
      enum: [
        "draft",
        "scheduled",
        "queued",
        "sent",
        "delivered",
        "failed",
        "cancelled",
      ],
      default: "draft",
    },
    providerMessageId: {
      type: String,
      trim: true,
      default: "",
    },
    errorMessage: {
      type: String,
      trim: true,
      default: "",
    },
    sentAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    rebookedAppointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
    recoveredRevenue: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    _id: true,
  }
);

const rebookingCampaignSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    channel: {
      type: String,
      enum: ["email", "sms"],
      required: true,
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "queued", "sent", "failed", "cancelled"],
      default: "draft",
      index: true,
    },
    scheduleAt: {
      type: Date,
      default: null,
      index: true,
    },
    duplicateWindowDays: {
      type: Number,
      min: 0,
      max: 365,
      default: 30,
    },
    recipients: {
      type: [recipientSchema],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

rebookingCampaignSchema.index({ createdAt: -1, status: 1 });

const RebookingCampaign =
  mongoose.models.RebookingCampaign ||
  mongoose.model("RebookingCampaign", rebookingCampaignSchema);

export default RebookingCampaign;
