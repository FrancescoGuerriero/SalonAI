import mongoose from "mongoose";

const caseSchema = new mongoose.Schema({
  caseId: { type: String, required: true, trim: true, maxlength: 160 },
  evidenceId: { type: String, required: true, trim: true, maxlength: 64 },
  evaluationRecord: { type: mongoose.Schema.Types.ObjectId, ref: "AiAdvisoryCandidateEvaluation", default: null },
  status: { type: String, enum: ["passed", "failed"], required: true },
  qualityGatePassed: { type: Boolean, default: false },
  baselineComparisonPassed: { type: Boolean, default: false },
  repeatedRunEvidenceSufficient: { type: Boolean, default: false },
  eligibleForPromotionReview: { type: Boolean, default: false },
  repeatedRunCount: { type: Number, min: 0, default: 0 },
  metrics: {
    citationIntegrityRate: { type: Number, min: 0, max: 1, default: 0 },
    factualGroundingRate: { type: Number, min: 0, max: 1, default: 0 },
    unsupportedClaimRate: { type: Number, min: 0, max: 1, default: 0 },
    provenanceValidityRate: { type: Number, min: 0, max: 1, default: 0 },
    provenanceCoverageRate: { type: Number, min: 0, max: 1, default: 0 },
    safetyCompliance: { type: Boolean, default: false },
    reproducible: { type: Boolean, default: false },
  },
  blockers: [{ type: String, trim: true, maxlength: 200 }],
  errorCode: { type: String, trim: true, maxlength: 160, default: "" },
  errorMessage: { type: String, trim: true, maxlength: 1000, default: "" },
}, { _id: false });

const schema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
  location: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
  runKey: { type: String, required: true, trim: true, maxlength: 160 },
  toolKey: { type: String, required: true, trim: true, maxlength: 120, default: "marketing-insights" },
  requestedAction: { type: String, enum: ["analyse", "summarise", "recommend"], default: "analyse" },
  candidateKind: { type: String, enum: ["shadow_model", "offline_model"], required: true },
  candidateVersion: { type: String, required: true, trim: true, maxlength: 160 },
  model: {
    name: { type: String, trim: true, maxlength: 160, default: "" },
    version: { type: String, trim: true, maxlength: 160, default: "" },
    algorithm: { type: String, trim: true, maxlength: 160, default: "" },
    artifactSha256: { type: String, required: true, trim: true, maxlength: 64 },
  },
  status: { type: String, enum: ["completed", "completed_with_failures"], required: true },
  requestedCaseCount: { type: Number, min: 1, max: 25, required: true },
  completedCaseCount: { type: Number, min: 0, max: 25, required: true },
  qualityPassedCases: { type: Number, min: 0, max: 25, default: 0 },
  baselinePassedCases: { type: Number, min: 0, max: 25, default: 0 },
  reproducibleCases: { type: Number, min: 0, max: 25, default: 0 },
  promotionReviewEligibleCases: { type: Number, min: 0, max: 25, default: 0 },
  cases: { type: [caseSchema], default: [] },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  productionPromotionAuthorised: { type: Boolean, default: false },
  productionInferenceAuthorised: { type: Boolean, default: false },
  deploymentAuthorised: { type: Boolean, default: false },
  externalWriteAuthorised: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ business: 1, location: 1, createdAt: -1 });
schema.index({ business: 1, location: 1, "model.artifactSha256": 1, createdAt: -1 });
schema.index({ business: 1, location: 1, runKey: 1 }, { unique: true });

export default mongoose.models.AiOfflineExperimentRun || mongoose.model("AiOfflineExperimentRun", schema);
