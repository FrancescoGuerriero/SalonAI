import mongoose from "mongoose";

const { Schema } = mongoose;

const crmActionDraftSchema = new Schema(
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
      required: true,
      index: true,
    },
    opportunityType: {
      type: String,
      enum: ["rebooking", "reactivation", "birthday", "referral", "loyalty"],
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ["email", "sms", "whatsapp", "in_person", "phone"],
      required: true,
    },
    subject: { type: String, trim: true, default: "", maxlength: 300 },
    body: { type: String, trim: true, required: true, maxlength: 5000 },
    status: {
      type: String,
      enum: ["draft", "reviewed", "discarded"],
      default: "draft",
      index: true,
    },
    evidence: {
      retentionState: { type: String, trim: true, default: "" },
      dueAt: { type: Date, default: null },
      cadenceDays: { type: Number, default: null },
      source: { type: String, default: "point9_deterministic_opportunity" },
    },
    executionAuthorised: { type: Boolean, default: false, immutable: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    discardedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    discardedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

crmActionDraftSchema.index({ business: 1, location: 1, customer: 1, createdAt: -1 });
crmActionDraftSchema.index({ business: 1, location: 1, status: 1, opportunityType: 1 });

crmActionDraftSchema.pre("validate", function guardExecution() {
  this.executionAuthorised = false;
});

export default mongoose.models.CrmActionDraft ||
  mongoose.model("CrmActionDraft", crmActionDraftSchema);
