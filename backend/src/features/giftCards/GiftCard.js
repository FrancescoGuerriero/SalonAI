import mongoose from "mongoose";

const txSchema = new mongoose.Schema({
  type: { type: String, enum: ["issue", "redeem", "refund", "adjustment"], required: true },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, min: 0, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const schema = new mongoose.Schema({
  codeHash: { type: String, required: true, unique: true },
  codeLastFour: { type: String, required: true },
  originalValue: { type: Number, min: 0, required: true },
  balance: { type: Number, min: 0, required: true },
  currency: { type: String, default: "GBP" },
  recipientName: String,
  recipientEmail: String,
  status: { type: String, enum: ["active", "disabled", "expired", "redeemed"], default: "active" },
  expiresAt: Date,
  transactions: { type: [txSchema], default: [] },
}, { timestamps: true, optimisticConcurrency: true });

export default mongoose.models.GiftCard || mongoose.model("GiftCard", schema);
