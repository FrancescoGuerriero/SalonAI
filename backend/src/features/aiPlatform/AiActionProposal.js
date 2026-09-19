import mongoose from "mongoose";

const { Schema } = mongoose;

export const AI_ACTION_PROPOSAL_STATUSES =
  Object.freeze([
    "pending",
    "approved",
    "rejected",
    "expired",
  ]);

export const AI_ACTION_EXECUTION_STATUSES =
  Object.freeze([
    "blocked",
    "preparing",
    "prepared",
    "failed",
  ]);

const aiActionProposalSchema =
  new Schema(
    {
      createdBy: {
        type:
          Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
      inferenceId: {
        type: String,
        trim: true,
        maxlength: 128,
        default: "",
        index: true,
      },
      actionType: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      domain: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      requiredPermission: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      targetType: {
        type: String,
        required: true,
        trim: true,
      },
      targetId: {
        type: String,
        required: true,
        trim: true,
        maxlength: 256,
        index: true,
      },
      contextPath: {
        type: String,
        trim: true,
        maxlength: 500,
        default: "",
      },
      summary: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300,
      },
      rationale: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: "",
      },
      proposedChanges: {
        type: Schema.Types.Mixed,
        default: {},
      },
      status: {
        type: String,
        enum:
          AI_ACTION_PROPOSAL_STATUSES,
        default: "pending",
        index: true,
      },
      expiresAt: {
        type: Date,
        required: true,
        index: true,
      },
      reviewedBy: {
        type:
          Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      reviewNote: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: "",
      },
      executionStatus: {
        type: String,
        enum:
          AI_ACTION_EXECUTION_STATUSES,
        default: "blocked",
      },
      executionBlockedReason: {
        type: String,
        trim: true,
        maxlength: 1000,
        default:
          "Approved proposals are review records only. SalonAI does not automatically execute Adviser proposals.",
      },
      executionResult: {
        type: Schema.Types.Mixed,
        default: null,
      },
      executedBy: {
        type:
          Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      executedAt: {
        type: Date,
        default: null,
      },
      executionError: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: "",
      },
    },
    {
      timestamps: true,
    }
  );

aiActionProposalSchema.index({
  status: 1,
  expiresAt: 1,
});

aiActionProposalSchema.index({
  requiredPermission: 1,
  status: 1,
  createdAt: -1,
});

const AiActionProposal =
  mongoose.models
    .AiActionProposal ||
  mongoose.model(
    "AiActionProposal",
    aiActionProposalSchema
  );

export default AiActionProposal;
