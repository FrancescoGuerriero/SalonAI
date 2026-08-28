import mongoose from "mongoose";

import "../../../models/user.js";

const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    direction: {
      type: String,
      enum: ["inbound", "outbound"],
      required: true,
    },

    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4096,
    },

    providerMessageId: {
      type: String,
      trim: true,
      default: "",
    },

    providerStatus: {
      type: String,
      enum: [
        "received",
        "accepted",
        "queued",
        "sending",
        "sent",
        "delivered",
        "read",
        "undelivered",
        "failed",
      ],
      default: "received",
    },

    error: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

const bookingSessionSchema = new Schema(
  {
    stage: {
      type: String,
      enum: [
        "idle",
        "service",
        "stylist",
        "date",
        "time",
        "review",
        "confirmed",
      ],
      default: "idle",
    },

    serviceId: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      default: null,
    },

    stylistId: {
      type: Schema.Types.ObjectId,
      ref: "Stylist",
      default: null,
    },

    appointmentDate: {
      type: Date,
      default: null,
    },

    appointmentTime: {
      type: String,
      trim: true,
      default: "",
      match: [
        /^$|^([01]\d|2[0-3]):[0-5]\d$/,
        "WhatsApp appointment time must use HH:mm format.",
      ],
    },

    duration: {
      type: Number,
      min: 1,
      max: 1440,
      default: null,
    },

    price: {
      type: Number,
      min: 0,
      default: null,
    },

    availableSlots: {
      type: [String],
      default: [],
    },

    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },

    confirmed: {
      type: Boolean,
      default: false,
    },

    confirmationState: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },

    confirmedAt: {
      type: Date,
      default: null,
    },

    confirmedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const whatsappConversationSchema = new Schema(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
      index: true,
    },

    displayName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },

    status: {
      type: String,
      enum: [
        "open",
        "collecting_details",
        "awaiting_confirmation",
        "confirming",
        "booked",
        "completed",
        "closed",
        "failed",
      ],
      default: "open",
      index: true,
    },

    bookingSession: {
      type: bookingSessionSchema,
      default: () => ({}),
    },

    messages: {
      type: [messageSchema],
      default: [],
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    lastMessagePreview: {
      type: String,
      trim: true,
      default: "",
      maxlength: 240,
    },

    lastInboundAt: {
      type: Date,
      default: null,
    },

    lastOutboundAt: {
      type: Date,
      default: null,
    },

    unreadCount: {
      type: Number,
      min: 0,
      default: 0,
    },

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

whatsappConversationSchema.index({
  phone: 1,
  lastMessageAt: -1,
});

whatsappConversationSchema.index({
  status: 1,
  lastMessageAt: -1,
});

whatsappConversationSchema.index({
  "messages.providerMessageId": 1,
});

const WhatsAppConversation =
  mongoose.models.WhatsAppConversation ||
  mongoose.model(
    "WhatsAppConversation",
    whatsappConversationSchema
  );

export {
  bookingSessionSchema,
  messageSchema,
};

export default WhatsAppConversation;
