import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    campaign: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      default: null,
      index: true,
    },
    lead: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    opportunity: {
      type: Schema.Types.ObjectId,
      ref: "Opportunity",
      default: null,
      index: true,
    },
    touchType: {
      type: String,
      enum: [
        "first_touch",
        "interaction",
        "lead_capture",
        "opportunity",
        "conversion",
      ],
      default: "interaction",
      index: true,
    },
    channel: {
      type: String,
      trim: true,
      lowercase: true,
      default: "other",
      maxlength: 80,
      index: true,
    },
    sourceSystem: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 120,
    },
    medium: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 120,
    },
    externalReference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    sourceKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 64,
    },
    utm: {
      source: { type: String, trim: true, lowercase: true, default: "", maxlength: 160 },
      medium: { type: String, trim: true, lowercase: true, default: "", maxlength: 160 },
      campaign: { type: String, trim: true, default: "", maxlength: 200 },
      term: { type: String, trim: true, default: "", maxlength: 200 },
      content: { type: String, trim: true, default: "", maxlength: 200 },
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

schema.index({ business: 1, lead: 1, occurredAt: 1, _id: 1 });
schema.index({ business: 1, customer: 1, occurredAt: 1, _id: 1 });
schema.index({ business: 1, campaign: 1, occurredAt: 1, _id: 1 });
schema.index(
  { business: 1, sourceKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceKey: { $type: "string", $gt: "" },
    },
  }
);

schema.pre("save", function blockMutation() {
  if (!this.isNew) {
    const error = new Error("Attribution touches are append-only.");
    error.code = "ATTRIBUTION_TOUCH_IMMUTABLE";
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
  schema.pre(operation, function blockQueryMutation() {
    const error = new Error("Attribution touches are append-only.");
    error.code = "ATTRIBUTION_TOUCH_IMMUTABLE";
    throw error;
  });
}

export default mongoose.models.AttributionTouch ||
  mongoose.model("AttributionTouch", schema);
