import mongoose from "mongoose";

const { Schema } = mongoose;

export const WORKFLOW_STATUSES = Object.freeze([
  "draft",
  "active",
  "paused",
  "retired",
]);

const workflowDefinitionSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    version: {
      type: Number,
      min: 1,
      required: true,
      default: 1,
    },
    status: {
      type: String,
      enum: WORKFLOW_STATUSES,
      default: "draft",
      index: true,
    },
    startActionKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    policy: {
      failClosed: {
        type: Boolean,
        default: true,
      },
      communicationClassification: {
        type: String,
        enum: ["none", "transactional", "marketing"],
        default: "none",
      },
      allowedChannels: {
        type: [String],
        default: [],
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

workflowDefinitionSchema.index(
  { business: 1, key: 1, version: 1 },
  { unique: true }
);
workflowDefinitionSchema.index({ business: 1, status: 1, key: 1 });

export default (
  mongoose.models.WorkflowDefinition ||
  mongoose.model("WorkflowDefinition", workflowDefinitionSchema)
);
