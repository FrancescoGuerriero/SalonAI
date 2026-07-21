import mongoose from "mongoose";

const customerContactLogSchema = new mongoose.Schema(
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
      default: null,
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
      index: true,
    },

    subject: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    message: {
      type: String,
      trim: true,
      maxlength: 5000,
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
      trim: true,
      maxlength: 320,
      default: "",
    },

    externalMessageId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    failureReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    sentAt: {
      type: Date,
      default: null,
      index: true,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    openedAt: {
      type: Date,
      default: null,
    },

    respondedAt: {
      type: Date,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

customerContactLogSchema.index({
  customer: 1,
  createdAt: -1,
});

customerContactLogSchema.index({
  campaignType: 1,
  status: 1,
  createdAt: -1,
});

customerContactLogSchema.index({
  channel: 1,
  status: 1,
});

customerContactLogSchema.pre("save", function setStatusDates(next) {
  const now = new Date();

  if (
    this.isModified("status") &&
    this.status === "sent" &&
    !this.sentAt
  ) {
    this.sentAt = now;
  }

  if (
    this.isModified("status") &&
    this.status === "delivered" &&
    !this.deliveredAt
  ) {
    this.deliveredAt = now;

    if (!this.sentAt) {
      this.sentAt = now;
    }
  }

  if (
    this.isModified("status") &&
    this.status === "opened" &&
    !this.openedAt
  ) {
    this.openedAt = now;
  }

  if (
    this.isModified("status") &&
    this.status === "responded" &&
    !this.respondedAt
  ) {
    this.respondedAt = now;
  }

  next();
});

customerContactLogSchema.virtual("isSuccessful").get(function () {
  return [
    "sent",
    "delivered",
    "opened",
    "responded",
  ].includes(this.status);
});

customerContactLogSchema.set("toJSON", {
  virtuals: true,
});

customerContactLogSchema.set("toObject", {
  virtuals: true,
});

const CustomerContactLog =
  mongoose.models.CustomerContactLog ||
  mongoose.model(
    "CustomerContactLog",
    customerContactLogSchema
  );

export default CustomerContactLog;