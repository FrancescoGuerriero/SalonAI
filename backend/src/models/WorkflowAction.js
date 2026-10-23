import mongoose from "mongoose";

const { Schema } = mongoose;

export const WORKFLOW_ACTION_TYPES = Object.freeze([
  "noop",
  "delay",
  "branch",
  "lead.timeline",
  "lead.score",
  "lead.nurture",
  "communication.enqueue",
  "booking_recovery.enqueue",
]);

const workflowActionSchema = new Schema(
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
    key: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    actionType: {
      type: String,
      enum: WORKFLOW_ACTION_TYPES,
      required: true,
      index: true,
    },
    position: {
      type: Number,
      min: 0,
      default: 0,
    },
    configuration: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    nextActionKey: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    trueActionKey: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    falseActionKey: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
  },
  { timestamps: true }
);

workflowActionSchema.index(
  { business: 1, workflow: 1, key: 1 },
  { unique: true }
);
workflowActionSchema.index({ business: 1, workflow: 1, position: 1 });

export default (
  mongoose.models.WorkflowAction ||
  mongoose.model("WorkflowAction", workflowActionSchema)
);
