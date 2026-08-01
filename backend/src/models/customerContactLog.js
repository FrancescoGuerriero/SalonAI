import mongoose from "mongoose";

const customerContactLogSchema =
  new mongoose.Schema(
    {
      customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        required: true,
        index: true,
      },
      appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Appointment",
        index: true,
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
        enum: [
          "email",
          "sms",
          "phone",
          "whatsapp",
          "in_app",
        ],
        required: true,
        index: true,
      },
      direction: {
        type: String,
        enum: ["outbound", "inbound"],
        default: "outbound",
      },
      subject: {
        type: String,
        default: "",
        trim: true,
      },
      message: {
        type: String,
        default: "",
      },
      status: {
        type: String,
        enum: [
          "draft",
          "queued",
          "sent",
          "delivered",
          "opened",
          "responded",
          "failed",
          "cancelled",
        ],
        default: "draft",
        index: true,
      },
      recipient: {
        type: String,
        default: "",
        trim: true,
      },
      externalMessageId: String,
      failureReason: String,
      sentAt: Date,
      deliveredAt: Date,
      openedAt: Date,
      respondedAt: Date,
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    {
      timestamps: true,
    }
  );

customerContactLogSchema.index({
  customer: 1,
  createdAt: -1,
});

const CustomerContactLog =
  mongoose.models.CustomerContactLog ||
  mongoose.model(
    "CustomerContactLog",
    customerContactLogSchema
  );

export default CustomerContactLog;
