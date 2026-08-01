import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      index: true,
    },
    purpose: {
      type: String,
      enum: [
        "appointment_deposit",
        "appointment_balance",
        "product_order",
        "membership",
        "other",
      ],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "GBP", uppercase: true },
    provider: { type: String, default: "console" },
    providerPaymentId: { type: String, index: true },
    providerIntentId: { type: String, index: true },
    checkoutUrl: { type: String, default: "" },
    clientSecret: { type: String, default: "" },
    rawStatus: { type: String, default: "" },
    status: {
      type: String,
      enum: [
        "pending",
        "authorised",
        "paid",
        "failed",
        "cancelled",
        "refunded",
        "partially_refunded",
      ],
      default: "pending",
      index: true,
    },
    paidAt: { type: Date, default: null },
    failureReason: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const Payment =
  mongoose.models.Payment ||
  mongoose.model("Payment", paymentSchema);

export default Payment;
