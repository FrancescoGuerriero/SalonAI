import mongoose from "mongoose";

const { Schema } = mongoose;

const metricStatisticSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    mean: { type: Number, required: true },
    median: { type: Number, required: true },
    p25: { type: Number, required: true },
    p75: { type: Number, required: true },
  },
  { _id: false }
);

const benchmarkCohortSnapshotSchema = new Schema(
  {
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
    metricCatalogueVersion: { type: String, required: true, trim: true },
    privacyPolicyVersion: { type: String, required: true, trim: true },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true, index: true },
    participantCount: { type: Number, required: true, min: 10 },
    participantCountBand: { type: String, required: true, trim: true },
    metrics: { type: [metricStatisticSchema], default: [] },
    sourceFingerprint: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-f0-9]{64}$/, "Benchmark source fingerprint must be SHA-256."],
    },
    disclosureControls: { type: [String], default: [] },
    differentialPrivacyApplied: { type: Boolean, default: false },
    generatedAt: { type: Date, default: Date.now, required: true, index: true },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

benchmarkCohortSnapshotSchema.index(
  {
    cohortKey: 1,
    periodStart: 1,
    metricCatalogueVersion: 1,
    sourceFingerprint: 1,
  },
  { unique: true }
);

benchmarkCohortSnapshotSchema.pre("save", function blockSnapshotMutation() {
  if (!this.isNew) {
    const error = new Error("Published benchmark cohort snapshots are immutable.");
    error.code = "BENCHMARK_SNAPSHOT_IMMUTABLE";
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
  "findOneAndDelete",
]) {
  benchmarkCohortSnapshotSchema.pre(operation, function blockSnapshotQueryMutation() {
    const error = new Error("Published benchmark cohort snapshots are immutable.");
    error.code = "BENCHMARK_SNAPSHOT_IMMUTABLE";
    throw error;
  });
}

export default (
  mongoose.models.BenchmarkCohortSnapshot ||
  mongoose.model("BenchmarkCohortSnapshot", benchmarkCohortSnapshotSchema)
);
