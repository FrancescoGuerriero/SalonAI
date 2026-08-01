import mongoose from "mongoose";

const schema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  endpoint: { type: String, required: true, unique: true },
  keys: { p256dh: String, auth: String },
  active: { type: Boolean, default: true },
  lastUsedAt: Date,
}, { timestamps: true });

export default mongoose.models.PushSubscription || mongoose.model("PushSubscription", schema);
