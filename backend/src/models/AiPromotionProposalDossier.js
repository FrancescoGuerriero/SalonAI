import mongoose from "mongoose";

const { Schema } = mongoose;

const checklistSchema = new Schema(
  {
    rollbackPlanDocumented: { type: Boolean, default: false },
    monitoringPlanDocumented: { type: Boolean, default: false },
    incidentOwnerAssigned: { type: Boolean, default: false },
    deploymentWindowDocumented: { type: Boolean, default: false },
    humanApprovalPathDocumented: { type: Boolean, default: false },
    externalWriteScopeDocumented: { type: Boolean, default: false },
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
    toolKey: { type: String, required: true, trim: true, maxlength: 120, index: true },
    candidateKind: { type: String, required: true, trim: true, maxlength: 80 },
    candidateVersion: { type: String, required: true, trim: true, maxlength: 160 },
    model: {
      name: { type: String, trim: true, maxlength: 160, default: "" },
      version: { type: String, trim: true, maxlength: 160, default: "" },
      algorithm: { type: String, trim: true, maxlength: 160, default: "" },
      artifactSha256: { type: String, trim: true, maxlength: 64, required: true },
    },
    governance: {
      registryVersion: { type: String, trim: true, maxlength: 40, default: "" },
      evaluationPolicyVersion: { type: String, required: true, trim: true, maxlength: 160 },
      baselineVersion: { type: String, required: true, trim: true, maxlength: 160 },
      assessmentHash: { type: String, required: true, trim: true, maxlength: 64 },
      evidenceId: { type: String, required: true, trim: true, maxlength: 64 },
      evidenceChecksum: { type: String, required: true, trim: true, maxlength: 64 },
      qualifyingOfflineCases: { type: Number, min: 0, required: true },
      requiredOfflineCases: { type: Number, min: 1, required: true },
      minimumRepeatedRunsPerCase: { type: Number, min: 1, required: true },
    },
    proposalStatus: {
      type: String,
      enum: ["draft", "ready_for_change_review", "withdrawn"],
      default: "draft",
      required: true,
      index: true,
    },
    rationale: { type: String, trim: true, maxlength: 6000, default: "" },
    expectedBenefit: { type: String, trim: true, maxlength: 4000, default: "" },
    riskAssessment: { type: String, trim: true, maxlength: 6000, default: "" },
    rollbackPlan: { type: String, trim: true, maxlength: 6000, default: "" },
    monitoringPlan: { type: String, trim: true, maxlength: 6000, default: "" },
    incidentOwner: { type: String, trim: true, maxlength: 240, default: "" },
    proposedDeploymentWindow: { type: String, trim: true, maxlength: 240, default: "" },
    checklist: { type: checklistSchema, default: () => ({}) },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    changeReviewRequestedAt: { type: Date, default: null },
    productionPromotionAuthorised: { type: Boolean, default: false },
    productionInferenceAuthorised: { type: Boolean, default: false },
    deploymentAuthorised: { type: Boolean, default: false },
    externalWriteAuthorised: { type: Boolean, default: false },
  },
  { timestamps: true }
);

schema.index({ business: 1, location: 1, createdAt: -1 });
schema.index({ business: 1, location: 1, proposalStatus: 1, createdAt: -1 });
schema.index({ business: 1, location: 1, candidateEvaluation: 1 }, { unique: true });

schema.pre("validate", function enforceNonExecutingBoundary(next) {
  this.productionPromotionAuthorised = false;
  this.productionInferenceAuthorised = false;
  this.deploymentAuthorised = false;
  this.externalWriteAuthorised = false;
  next();
});

export default mongoose.models.AiPromotionProposalDossier
  || mongoose.model("AiPromotionProposalDossier", schema);
