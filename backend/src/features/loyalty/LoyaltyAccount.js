import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ["earn", "redeem", "adjustment"], required: true },
  points: { type: Number, required: true },
  balanceAfter: { type: Number, min: 0, required: true },
  sourceType: String,
  sourceId: mongoose.Schema.Types.ObjectId,
  idempotencyKey: { type: String, sparse: true },
  description: String,
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const schema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },
  pointsBalance: { type: Number, min: 0, default: 0 },
  lifetimePointsEarned: { type: Number, min: 0, default: 0 },
  lifetimePointsRedeemed: { type: Number, min: 0, default: 0 },
  tier: { type: String, default: "bronze" },
  status: { type: String, enum: ["active", "suspended", "closed"], default: "active" },
  transactions: { type: [transactionSchema], default: [] },
}, { timestamps: true, optimisticConcurrency: true });

export default mongoose.models.LoyaltyAccount ||
  mongoose.model("LoyaltyAccount", schema);
