import mongoose from "mongoose";

const { Schema } = mongoose;

export const WORKFLOW_RUN_STATUSES = Object.freeze([
  "pending",
  "running",
  "waiting",
  "completed",
  "failed",
  "blocked",
  "cancelled",
]);

const historySchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: WORKFLOW_RUN_STATUSES,
      required: true,
    },
    actionKey: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    message: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { _id: false }
);

const workflowRunSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    workflow: {
      type: Schema.Types.ObjectId,
      ref: "WorkflowDefinition",
      required: true,
      index: true,
    },
    trigger: {
      type: Schema.Types.ObjectId,
      ref: "TriggerDefinition",
      required: true,
      index: true,
    },
    domainEvent: {
      type: Schema.Types.ObjectId,
      ref: "DomainEvent",
      required: true,
      index: true,
    },
    sourceEventId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    status: {
      type: String,
      enum: WORKFLOW_RUN_STATUSES,
      default: "pending",
      index: true,
    },
    currentActionKey: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    nextRunAt: {
      type: Date,
      default: null,
      index: true,
    },
    context: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    completedActionKeys: {
      type: [String],
      default: [],
    },
    history: {
      type: [historySchema],
      default: [],
    },
    failureCode: {
      type: String,
      trim: true,
      default: "",
      maxlength: 160,
    },
    failureReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 3000,
    },
    lockedAt: {
      type: Date,
      default: null,
      index: true,
    },
    lockedBy: {
      type: String,
      trim: true,
      default: "",
      maxlength: 160,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

workflowRunSchema.index(
  { business: 1, idempotencyKey: 1 },
  { unique: true }
);
workflowRunSchema.index({ status: 1, nextRunAt: 1, lockedAt: 1 });
workflowRunSchema.index({ business: 1, workflow: 1, createdAt: -1 });

export default (
  mongoose.models.WorkflowRun ||
  mongoose.model("WorkflowRun", workflowRunSchema)
);
