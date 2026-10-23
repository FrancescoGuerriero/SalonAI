import mongoose from "mongoose";

const { Schema } = mongoose;

const metricValueSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    value: { type: Number, required: true },
  },
  { _id: false }
);

const benchmarkMetricContributionSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    participation: {
      type: Schema.Types.ObjectId,
      ref: "BenchmarkParticipation",
      required: true,
      index: true,
    },
    cohortKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
      maxlength: 240,
    },
    cohortDimensions: {
      vertical: { type: String, required: true, trim: true, lowercase: true },
      currency: { type: String, required: true, trim: true, uppercase: true },
    },
    metricCatalogueVersion: {
      type: String,
      required: true,
      trim: true,
    },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true, index: true },
    sourceSampleSize: { type: Number, required: true, min: 0 },
    metrics: { type: [metricValueSchema], default: [] },
    contributionFingerprint: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-f0-9]{64}$/, "Contribution fingerprint must be SHA-256."],
    },
    generatedAt: { type: Date, default: Date.now, required: true, index: true },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

benchmarkMetricContributionSchema.index(
  { business: 1, periodStart: 1, cohortKey: 1, metricCatalogueVersion: 1 },
  { unique: true }
);
benchmarkMetricContributionSchema.index({ cohortKey: 1, periodStart: 1, generatedAt: -1 });

export default (
  mongoose.models.BenchmarkMetricContribution ||
  mongoose.model("BenchmarkMetricContribution", benchmarkMetricContributionSchema)
);
