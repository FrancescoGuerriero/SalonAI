import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 40 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 750 },
    discountType: { type: String, enum: ["percentage", "fixed"], required: true },
    value: { type: Number, min: 0.01, required: true },
    minimumSpend: { type: Number, min: 0, default: 0 },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, required: true },
    active: { type: Boolean, default: true, index: true },
    maxClaims: { type: Number, min: 1, default: null },
    claimCount: { type: Number, min: 0, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

schema.index({ active: 1, startsAt: 1, endsAt: 1 });

export default mongoose.models.SalonOffer || mongoose.model("SalonOffer", schema);
