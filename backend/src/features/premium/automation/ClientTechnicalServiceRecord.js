import mongoose from "mongoose";

const { Schema } = mongoose;

const formulaComponentSchema = new Schema(
  {
    brand: { type: String, trim: true, default: "", maxlength: 120 },
    line: { type: String, trim: true, default: "", maxlength: 120 },
    shade: { type: String, trim: true, default: "", maxlength: 120 },
    developer: { type: String, trim: true, default: "", maxlength: 120 },
    ratio: { type: String, trim: true, default: "", maxlength: 80 },
    quantity: { type: Number, min: 0, default: null },
    unit: { type: String, enum: ["", "g", "ml", "oz"], default: "" },
    notes: { type: String, trim: true, default: "", maxlength: 1000 },
  },
  { _id: false }
);

const photoSchema = new Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 2000 },
    kind: {
      type: String,
      enum: ["before", "after", "consultation", "formula", "other"],
      default: "other",
    },
    caption: { type: String, trim: true, default: "", maxlength: 500 },
  },
  { _id: false }
);

const patchTestSchema = new Schema(
  {
    required: { type: Boolean, default: false },
    performedAt: { type: Date, default: null },
    result: {
      type: String,
      enum: ["", "passed", "failed", "inconclusive", "not_required"],
      default: "",
    },
    notes: { type: String, trim: true, default: "", maxlength: 1000 },
  },
  { _id: false }
);

const clientTechnicalServiceRecordSchema = new Schema(
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
    appointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
      index: true,
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      default: null,
    },
    stylist: {
      type: Schema.Types.ObjectId,
      ref: "Stylist",
      default: null,
    },
    recordType: {
      type: String,
      enum: ["colour", "chemical", "treatment", "cut", "consultation", "general"],
      default: "general",
      index: true,
    },
    occurredAt: { type: Date, required: true, default: Date.now, index: true },
    formula: { type: [formulaComponentSchema], default: [] },
    technicalNotes: { type: String, trim: true, default: "", maxlength: 10000 },
    resultNotes: { type: String, trim: true, default: "", maxlength: 5000 },
    patchTest: { type: patchTestSchema, default: () => ({}) },
    photos: { type: [photoSchema], default: [] },
    source: {
      type: String,
      enum: ["appointment", "consultation", "manual"],
      default: "manual",
    },
    status: {
      type: String,
      enum: ["active", "superseded"],
      default: "active",
      index: true,
    },
    supersedes: {
      type: Schema.Types.ObjectId,
      ref: "ClientTechnicalServiceRecord",
      default: null,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

clientTechnicalServiceRecordSchema.index({
  business: 1,
  location: 1,
  customer: 1,
  occurredAt: -1,
});
clientTechnicalServiceRecordSchema.index({
  business: 1,
  location: 1,
  recordType: 1,
  occurredAt: -1,
});
clientTechnicalServiceRecordSchema.index(
  { business: 1, location: 1, appointment: 1 },
  { sparse: true }
);

export default mongoose.models.ClientTechnicalServiceRecord ||
  mongoose.model("ClientTechnicalServiceRecord", clientTechnicalServiceRecordSchema);
