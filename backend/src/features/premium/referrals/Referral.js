import mongoose from "mongoose";

const schema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, index: true },
  referrer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  referredCustomer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  referredEmail: { type: String, lowercase: true, trim: true },
  status: { type: String, enum: ["invited", "registered", "qualified", "rewarded", "rejected"], default: "invited" },
  qualifyingSourceId: mongoose.Schema.Types.ObjectId,
  qualifiedAt: Date,
  rewardedAt: Date,
}, { timestamps: true });

export default mongoose.models.Referral || mongoose.model("Referral", schema);
