import mongoose from "mongoose";

const { Schema } = mongoose;

export const LEAD_STATUSES = Object.freeze([
  "new",
  "contacted",
  "qualified",
  "nurturing",
  "converted",
  "disqualified",
  "lost",
]);

export const LEAD_SOURCE_CHANNELS = Object.freeze([
  "web",
  "whatsapp",
  "sms",
  "phone",
  "email",
  "social",
  "google",
  "referral",
  "walk_in",
  "import",
  "api",
  "other",
]);

const leadSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    firstName: { type: String, trim: true, default: "", maxlength: 100 },
    lastName: { type: String, trim: true, default: "", maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, default: "", maxlength: 254, index: true },
    phone: { type: String, trim: true, default: "", maxlength: 40, index: true },
    status: { type: String, enum: LEAD_STATUSES, default: "new", index: true },
    source: {
      channel: { type: String, enum: LEAD_SOURCE_CHANNELS, default: "other" },
      system: { type: String, trim: true, lowercase: true, default: "", maxlength: 120 },
      campaign: { type: String, trim: true, default: "", maxlength: 180 },
      medium: { type: String, trim: true, default: "", maxlength: 120 },
      externalReference: { type: String, trim: true, default: "", maxlength: 500 },
    },
    sourceKey: { type: String, trim: true, lowercase: true, default: "", maxlength: 64 },
    idempotencyKey: { type: String, trim: true, default: "", maxlength: 255 },
    interestedServices: { type: [{ type: Schema.Types.ObjectId, ref: "Service" }], default: [] },
    estimatedValue: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "GBP", minlength: 3, maxlength: 3 },
    assignedUser: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    currentScore: { type: Number, min: 0, max: 100, default: 0 },
    scoreBand: { type: String, enum: ["cold", "warm", "hot"], default: "cold", index: true },
    lastScoredAt: { type: Date, default: null },
    nurture: {
      workflowKey: { type: String, trim: true, default: "", maxlength: 160 },
      status: { type: String, enum: ["none", "pending", "enrolled", "paused", "completed", "cancelled"], default: "none" },
      nextActionAt: { type: Date, default: null },
      lastActionAt: { type: Date, default: null },
    },
    convertedAt: { type: Date, default: null },
    lostReason: { type: String, trim: true, default: "", maxlength: 1000 },
    disqualifiedReason: { type: String, trim: true, default: "", maxlength: 1000 },
    notes: { type: String, trim: true, default: "", maxlength: 4000 },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, optimisticConcurrency: true }
);

leadSchema.index({ business: 1, location: 1, status: 1, createdAt: -1 });
leadSchema.index({ business: 1, location: 1, email: 1, status: 1 });
leadSchema.index({ business: 1, location: 1, phone: 1, status: 1 });
leadSchema.index(
  { business: 1, location: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } },
  }
);
leadSchema.index(
  { business: 1, location: 1, sourceKey: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceKey: { $type: "string", $gt: "" } },
  }
);

export default mongoose.models.Lead || mongoose.model("Lead", leadSchema);
