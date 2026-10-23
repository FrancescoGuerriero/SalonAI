import mongoose from "mongoose";

const { Schema } = mongoose;

const sourceSnapshotSchema = new Schema(
  {
    channel: {
      type: String,
      enum: ["web", "whatsapp", "sms", "phone", "email", "social", "google", "referral", "walk_in", "import", "api", "other"],
      default: "other",
      index: true,
    },
    system: { type: String, trim: true, lowercase: true, default: "", maxlength: 120 },
    campaign: { type: String, trim: true, default: "", maxlength: 180 },
    medium: { type: String, trim: true, default: "", maxlength: 120 },
    term: { type: String, trim: true, default: "", maxlength: 300 },
    content: { type: String, trim: true, default: "", maxlength: 300 },
    landingPage: { type: String, trim: true, default: "", maxlength: 2000 },
    referrer: { type: String, trim: true, default: "", maxlength: 2000 },
    googleClickId: { type: String, trim: true, default: "", maxlength: 500 },
    metaClickId: { type: String, trim: true, default: "", maxlength: 500 },
    microsoftClickId: { type: String, trim: true, default: "", maxlength: 500 },
    externalReference: { type: String, trim: true, default: "", maxlength: 500 },
  },
  { _id: false }
);

const schema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    lead: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    opportunity: { type: Schema.Types.ObjectId, ref: "Opportunity", default: null, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    appointment: { type: Schema.Types.ObjectId, ref: "Appointment", required: true, index: true },
    method: {
      type: String,
      enum: ["explicit", "post_conversion_reconcile", "provider_reference"],
      default: "explicit",
      index: true,
    },
    source: { type: sourceSnapshotSchema, default: () => ({}) },
    linkedAt: { type: Date, default: Date.now, index: true },
    leadCapturedAt: { type: Date, default: null },
    leadConvertedAt: { type: Date, default: null },
    appointmentStartsAt: { type: Date, default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

schema.index({ business: 1, appointment: 1 }, { unique: true });
schema.index({ business: 1, lead: 1, appointmentStartsAt: 1 });
schema.index({ business: 1, "source.channel": 1, "source.campaign": 1, appointmentStartsAt: 1 });

schema.pre("save", function blockAttributionMutation() {
  if (!this.isNew) {
    const error = new Error("Growth attribution records are immutable evidence.");
    error.code = "GROWTH_ATTRIBUTION_IMMUTABLE";
    throw error;
  }
});

for (const operation of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "findOneAndReplace",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
]) {
  schema.pre(operation, function blockAttributionQueryMutation() {
    const error = new Error("Growth attribution records are immutable evidence.");
    error.code = "GROWTH_ATTRIBUTION_IMMUTABLE";
    throw error;
  });
}

export default mongoose.models.GrowthAttribution ||
  mongoose.model("GrowthAttribution", schema);
