import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      index: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "GBP",
    },

    type: {
      type: String,
      enum: [
        "deposit",
        "balance",
        "full_payment",
        "refund",
        "gift_card",
        "tip",
      ],
      default: "full_payment",
    },

    method: {
      type: String,
      enum: [
        "cash",
        "card",
        "stripe",
        "bank_transfer",
        "gift_card",
      ],
      required: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "paid",
        "failed",
        "cancelled",
        "refunded",
      ],
      default: "pending",
      index: true,
    },

    stripePaymentIntentId: {
      type: String,
      default: null,
    },

    stripeChargeId: {
      type: String,
      default: null,
    },

    receiptNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    transactionReference: {
      type: String,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({
  customer: 1,
  createdAt: -1,
});

paymentSchema.index({
  appointment: 1,
  status: 1,
});

export default mongoose.model("Payment", paymentSchema);