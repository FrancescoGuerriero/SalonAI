import mongoose from "mongoose";

const { Schema } = mongoose;

export const AI_ACTION_OUTCOME_STATUSES = Object.freeze([
  "implemented",
  "not_implemented",
  "invalidated",
  "reversed",
]);

const aiActionOutcomeSchema = new Schema(
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
    proposal: {
      type: Schema.Types.ObjectId,
      ref: "AiActionProposal",
      required: true,
      index: true,
    },
    agentRun: {
      type: Schema.Types.ObjectId,
      ref: "AiAgentRun",
      default: null,
      index: true,
    },
    agentKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 120,
      index: true,
    },
    status: {
      type: String,
      enum: AI_ACTION_OUTCOME_STATUSES,
      required: true,
      index: true,
    },
    taskSuccess: {
      type: Boolean,
      default: null,
    },
    policyViolation: {
      type: Boolean,
      default: false,
    },
    overridden: {
      type: Boolean,
      default: false,
    },
    reversed: {
      type: Boolean,
      default: false,
    },
    businessMetricKey: {
      type: String,
      trim: true,
      default: "",
      maxlength: 160,
    },
    businessMetricDelta: {
      type: Number,
      default: null,
    },
    evidenceRefs: {
      type: [String],
      default: [],
    },
    note: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    observedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    observedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

aiActionOutcomeSchema.index({
  business: 1,
  proposal: 1,
  observedAt: -1,
});
aiActionOutcomeSchema.index({
  business: 1,
  agentKey: 1,
  observedAt: -1,
});
aiActionOutcomeSchema.index({
  business: 1,
  status: 1,
  observedAt: -1,
});

export default (
  mongoose.models.AiActionOutcome ||
  mongoose.model("AiActionOutcome", aiActionOutcomeSchema)
);
