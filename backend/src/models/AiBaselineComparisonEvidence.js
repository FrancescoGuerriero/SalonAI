import mongoose from "mongoose";

const { Schema } = mongoose;

const metricDeltaSchema = new Schema(
  {
    metric: { type: String, required: true, trim: true, maxlength: 120 },
    direction: { type: String, enum: ["higher_or_equal", "lower_or_equal", "equal"], required: true },
    baselineValue: { type: Number, required: true },
    candidateValue: { type: Number, required: true },
    delta: { type: Number, required: true },
    nonDegraded: { type: Boolean, required: true },
  },
  { _id: false }
);

const schema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    location: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    candidateEvaluation: { type: Schema.Types.ObjectId, ref: "AiAdvisoryCandidateEvaluation", required: true, index: true },
    baselineEvaluation: { type: Schema.Types.ObjectId, ref: "AiAdvisoryCandidateEvaluation", required: true, index: true },
    toolKey: { type: String, required: true, trim: true, maxlength: 120, index: true },
    evidenceId: { type: String, required: true, trim: true, maxlength: 64, index: true },
    candidateKind: { type: String, enum: ["shadow_model", "offline_model"], required: true },
    candidateVersion: { type: String, required: true, trim: true, maxlength: 160 },
    baselineVersion: { type: String, required: true, trim: true, maxlength: 160 },
    artifactSha256: { type: String, required: true, trim: true, maxlength: 64, index: true },
    manifestBaselineAssertion: { type: Boolean, required: true },
    metricDeltas: { type: [metricDeltaSchema], default: () => [] },
    identityNonDegraded: { type: Boolean, required: true },
    safetyNonDegraded: { type: Boolean, required: true },
    reproducibilityNonDegraded: { type: Boolean, required: true },
    allMetricsNonDegraded: { type: Boolean, required: true, index: true },
    baselineComparisonPassed: { type: Boolean, required: true, index: true },
    blockers: { type: [String], default: () => [] },
    comparisonHash: { type: String, required: true, trim: true, maxlength: 64, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    productionPromotionAuthorised: { type: Boolean, default: false },
    productionInferenceAuthorised: { type: Boolean, default: false },
    deploymentAuthorised: { type: Boolean, default: false },
    externalWriteAuthorised: { type: Boolean, default: false },
  },
  { timestamps: true }
);

schema.index({ business: 1, location: 1, candidateEvaluation: 1 }, { unique: true });
schema.index({ business: 1, location: 1, artifactSha256: 1, createdAt: -1 });
schema.index({ business: 1, location: 1, evidenceId: 1, baselineVersion: 1 });

schema.pre("validate", function enforceNonExecutingBoundary(next) {
  this.productionPromotionAuthorised = false;
  this.productionInferenceAuthorised = false;
  this.deploymentAuthorised = false;
  this.externalWriteAuthorised = false;
  next();
});

export default mongoose.models.AiBaselineComparisonEvidence
  || mongoose.model("AiBaselineComparisonEvidence", schema);
