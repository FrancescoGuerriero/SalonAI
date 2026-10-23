import mongoose from "mongoose";

const { Schema } = mongoose;

export const PRICING_EXPERIMENT_STATUSES = Object.freeze([
  "draft",
  "running",
  "completed",
  "cancelled",
]);

const pricingExperimentSchema = new Schema(
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
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    hypothesis: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: PRICING_EXPERIMENT_STATUSES,
      default: "draft",
      index: true,
    },
    mode: {
      type: String,
      enum: ["simulation_only"],
      default: "simulation_only",
      immutable: true,
    },
    priceRules: {
      type: [{ type: Schema.Types.ObjectId, ref: "PriceRule" }],
      default: [],
    },
    analysisMonths: {
      type: Number,
      min: 1,
      max: 24,
      default: 6,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    startedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resultSnapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },
    safeguards: {
      productionDeploymentAllowed: { type: Boolean, default: false },
      personalisationAllowed: { type: Boolean, default: false },
      causalUpliftClaimAllowed: { type: Boolean, default: false },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, optimisticConcurrency: true }
);

pricingExperimentSchema.index({ business: 1, status: 1, createdAt: -1 });

export default (
  mongoose.models.PricingExperiment ||
  mongoose.model("PricingExperiment", pricingExperimentSchema)
);
