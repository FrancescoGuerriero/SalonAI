import mongoose from "mongoose";

const { Schema } = mongoose;

const metricSchema = new Schema(
  {
    identityMatch: { type: Boolean, required: true },
    citationIntegrityRate: { type: Number, min: 0, max: 1, required: true },
    factualGroundingRate: { type: Number, min: 0, max: 1, required: true },
    unsupportedClaimRate: { type: Number, min: 0, max: 1, required: true },
    provenanceValidityRate: { type: Number, min: 0, max: 1, required: true },
    provenanceCoverageRate: { type: Number, min: 0, max: 1, required: true },
    safetyCompliance: { type: Boolean, required: true },
    reproducible: { type: Boolean, default: null },
  },
  { _id: false }
);

const promotionReadinessSchema = new Schema(
  {
    requiredOfflineCases: { type: Number, min: 1, required: true },
    qualifyingOfflineCases: { type: Number, min: 0, required: true },
    minimumRepeatedRunsPerCase: { type: Number, min: 1, required: true },
    repeatedRunCount: { type: Number, min: 0, required: true },
    candidateOutputIncludedInRepeatedRuns: { type: Boolean, required: true },
    repeatedRunEvidenceSufficient: { type: Boolean, required: true },
    suiteGatePassed: { type: Boolean, required: true },
  },
  { _id: false }
);

const schema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    location: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    toolKey: { type: String, required: true, trim: true, maxlength: 120, index: true },
    requestedAction: {
      type: String,
      enum: ["analyse", "summarise", "recommend"],
      required: true,
      index: true,
    },
    candidateKind: {
      type: String,
      enum: ["deterministic_baseline", "shadow_model", "offline_model"],
      required: true,
      index: true,
    },
    registryVersion: { type: String, trim: true, maxlength: 40, default: "" },
    candidateVersion: { type: String, required: true, trim: true, maxlength: 160 },
    candidateOutputHash: { type: String, required: true, trim: true, maxlength: 64 },
    model: {
      name: { type: String, trim: true, maxlength: 160, default: "" },
      version: { type: String, trim: true, maxlength: 160, default: "" },
      algorithm: { type: String, trim: true, maxlength: 160, default: "" },
      artifactSha256: { type: String, trim: true, maxlength: 64, default: "" },
      artifactManifestSchema: { type: String, trim: true, maxlength: 120, default: "" },
      artifactLifecycle: {
        type: String,
        enum: ["", "experiment", "candidate"],
        default: "",
      },
    },
    baselineManifestAssertion: { type: Boolean, default: null },
    baselineComparisonPassed: { type: Boolean, required: true },
    baselineComparisonSource: {
      type: String,
      enum: ["not_applicable", "manifest_declaration", "evidence_derived"],
      default: "manifest_declaration",
      index: true,
    },
    baselineComparisonEvidence: {
      type: Schema.Types.ObjectId,
      ref: "AiBaselineComparisonEvidence",
      default: null,
      index: true,
    },
    artifactPromotionEligible: { type: Boolean, required: true },
    evidenceId: { type: String, required: true, trim: true, maxlength: 64, index: true },
    evidenceContract: { type: String, required: true, trim: true, maxlength: 120 },
    evidenceChecksum: { type: String, required: true, trim: true, maxlength: 64 },
    factCount: { type: Number, min: 0, default: 0 },
    provenanceCount: { type: Number, min: 0, default: 0 },
    policyVersion: { type: String, required: true, trim: true, maxlength: 160, index: true },
    baselineVersion: { type: String, required: true, trim: true, maxlength: 160 },
    assessmentHash: { type: String, required: true, trim: true, maxlength: 64, index: true },
    metrics: { type: metricSchema, required: true },
    blockers: { type: [String], default: () => [] },
    qualityGatePassed: { type: Boolean, required: true, index: true },
    promotionReadiness: { type: promotionReadinessSchema, required: true },
    eligibleForPromotionReview: { type: Boolean, required: true, index: true },
    promotionReviewStatus: {
      type: String,
      enum: ["not_eligible", "pending_review", "accepted_for_promotion_proposal", "rejected"],
      required: true,
      index: true,
    },
    reviewerNote: { type: String, trim: true, maxlength: 2000, default: "" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    productionPromotionAuthorised: { type: Boolean, default: false },
    productionInferenceAuthorised: { type: Boolean, default: false },
    externalWriteAuthorised: { type: Boolean, default: false },
  },
  { timestamps: true }
);

schema.index({ business: 1, location: 1, createdAt: -1 });
schema.index({ business: 1, location: 1, toolKey: 1, createdAt: -1 });
schema.index({ business: 1, location: 1, candidateKind: 1, promotionReviewStatus: 1, createdAt: -1 });
schema.index({ business: 1, location: 1, evidenceId: 1, assessmentHash: 1 });
schema.index({ business: 1, location: 1, "model.artifactSha256": 1, policyVersion: 1, baselineVersion: 1 });

schema.pre("validate", function enforceGovernanceLocks(next) {
  this.productionPromotionAuthorised = false;
  this.productionInferenceAuthorised = false;
  this.externalWriteAuthorised = false;

  if (this.candidateKind === "deterministic_baseline") {
    this.baselineComparisonSource = "not_applicable";
    this.baselineComparisonEvidence = null;
    this.baselineComparisonPassed = true;
    this.artifactPromotionEligible = false;
    this.eligibleForPromotionReview = false;
    if (!["accepted_for_promotion_proposal", "rejected"].includes(this.promotionReviewStatus)) {
      this.promotionReviewStatus = "not_eligible";
    }
  } else {
    if (this.baselineManifestAssertion === null || typeof this.baselineManifestAssertion === "undefined") {
      this.baselineManifestAssertion = this.baselineComparisonPassed === true;
    }
    if (this.baselineComparisonSource !== "evidence_derived" || !this.baselineComparisonEvidence) {
      this.baselineComparisonSource = "manifest_declaration";
      this.baselineComparisonPassed = false;
      this.artifactPromotionEligible = false;
      this.eligibleForPromotionReview = false;
      if (this.promotionReadiness) {
        this.promotionReadiness.qualifyingOfflineCases = 0;
        this.promotionReadiness.suiteGatePassed = false;
      }
      if (!["accepted_for_promotion_proposal", "rejected"].includes(this.promotionReviewStatus)) {
        this.promotionReviewStatus = "not_eligible";
      }
    }
  }
  next();
});

export default mongoose.models.AiAdvisoryCandidateEvaluation
  || mongoose.model("AiAdvisoryCandidateEvaluation", schema);
