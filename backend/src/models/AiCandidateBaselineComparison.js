import mongoose from "mongoose";

const { Schema } = mongoose;

const metricDeltaSchema = new Schema(
  {
    candidate: { type: Number, required: true },
    baseline: { type: Number, required: true },
    delta: { type: Number, required: true },
    direction: { type: String, enum: ["better", "equal", "worse"], required: true },
    nonDegradationPassed: { type: Boolean, required: true },
  },
  { _id: false }
);

const schema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    location: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    candidateEvaluation: {
      type: Schema.Types.ObjectId,
      ref: "AiAdvisoryCandidateEvaluation",
      required: true,
      index: true,
    },
    baselineEvaluation: {
      type: Schema.Types.ObjectId,
      ref: "AiAdvisoryCandidateEvaluation",
      required: true,
      index: true,
    },
    toolKey: { type: String, required: true, trim: true, maxlength: 120, index: true },
    requestedAction: {
      type: String,
      enum: ["analyse", "summarise", "recommend"],
      required: true,
    },
    evidenceId: { type: String, required: true, trim: true, maxlength: 64, index: true },
    candidateVersion: { type: String, required: true, trim: true, maxlength: 160 },
    baselineVersion: { type: String, required: true, trim: true, maxlength: 160 },
    model: {
      name: { type: String, trim: true, maxlength: 160, default: "" },
      version: { type: String, trim: true, maxlength: 160, default: "" },
      algorithm: { type: String, trim: true, maxlength: 160, default: "" },
      artifactSha256: { type: String, trim: true, maxlength: 64, required: true },
    },
    metricDeltas: {
      citationIntegrityRate: { type: metricDeltaSchema, required: true },
      factualGroundingRate: { type: metricDeltaSchema, required: true },
      unsupportedClaimRate: { type: metricDeltaSchema, required: true },
      provenanceValidityRate: { type: metricDeltaSchema, required: true },
      provenanceCoverageRate: { type: metricDeltaSchema, required: true },
    },
    identityNonDegradationPassed: { type: Boolean, required: true },
    safetyNonDegradationPassed: { type: Boolean, required: true },
    candidateQualityGatePassed: { type: Boolean, required: true },
    baselineQualityGatePassed: { type: Boolean, required: true },
    candidateRepeatedRunEvidenceSufficient: { type: Boolean, required: true },
    nonDegradationPassed: { type: Boolean, required: true, index: true },
    overallDecision: {
      type: String,
      enum: ["better", "equal", "worse", "mixed"],
      required: true,
      index: true,
    },
    blockers: { type: [String], default: () => [] },
    comparedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    productionPromotionAuthorised: { type: Boolean, default: false },
    productionInferenceAuthorised: { type: Boolean, default: false },
    deploymentAuthorised: { type: Boolean, default: false },
    externalWriteAuthorised: { type: Boolean, default: false },
  },
  { timestamps: true }
);

schema.index({ business: 1, location: 1, createdAt: -1 });
schema.index({ business: 1, location: 1, evidenceId: 1, createdAt: -1 });
schema.index({ business: 1, location: 1, "model.artifactSha256": 1, createdAt: -1 });
schema.index({ business: 1, location: 1, candidateEvaluation: 1 }, { unique: true });

schema.pre("validate", function enforceNonExecutingBoundary(next) {
  this.productionPromotionAuthorised = false;
  this.productionInferenceAuthorised = false;
  this.deploymentAuthorised = false;
  this.externalWriteAuthorised = false;
  next();
});

export default mongoose.models.AiCandidateBaselineComparison
  || mongoose.model("AiCandidateBaselineComparison", schema);
