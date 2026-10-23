import mongoose from "mongoose";

const { Schema } = mongoose;

const benchmarkParticipationSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    granted: {
      type: Boolean,
      required: true,
      index: true,
    },
    policyVersion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    metricCatalogueVersion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    allowedMetricKeys: {
      type: [String],
      default: [],
    },
    purpose: {
      type: String,
      enum: ["aggregate_benchmarking"],
      default: "aggregate_benchmarking",
      required: true,
    },
    noticeAcknowledged: {
      type: Boolean,
      required: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    supersedes: {
      type: Schema.Types.ObjectId,
      ref: "BenchmarkParticipation",
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

benchmarkParticipationSchema.index({ business: 1, recordedAt: -1, _id: -1 });

benchmarkParticipationSchema.pre("save", function blockParticipationMutation() {
  if (!this.isNew) {
    const error = new Error(
      "Benchmark participation evidence is append-only; record a new grant or withdrawal instead."
    );
    error.code = "BENCHMARK_PARTICIPATION_IMMUTABLE";
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
  benchmarkParticipationSchema.pre(operation, function blockParticipationQueryMutation() {
    const error = new Error(
      "Benchmark participation evidence is append-only; record a new grant or withdrawal instead."
    );
    error.code = "BENCHMARK_PARTICIPATION_IMMUTABLE";
    throw error;
  });
}

export default (
  mongoose.models.BenchmarkParticipation ||
  mongoose.model("BenchmarkParticipation", benchmarkParticipationSchema)
);
