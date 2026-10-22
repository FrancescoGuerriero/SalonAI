import mongoose from "mongoose";

const { Schema } = mongoose;

export const WORKFLOW_CONDITION_OPERATORS = Object.freeze([
  "eq",
  "ne",
  "exists",
  "in",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
]);

const conditionSchema = new Schema(
  {
    path: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    operator: {
      type: String,
      enum: WORKFLOW_CONDITION_OPERATORS,
      required: true,
      default: "eq",
    },
    value: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false }
);

const triggerDefinitionSchema = new Schema(
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
    type: {
      type: String,
      enum: ["domain_event"],
      default: "domain_event",
      required: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
      index: true,
    },
    eventVersion: {
      type: String,
      required: true,
      trim: true,
      default: "1",
      maxlength: 32,
      index: true,
    },
    conditions: {
      type: [conditionSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

triggerDefinitionSchema.index({
  business: 1,
  eventType: 1,
  eventVersion: 1,
  status: 1,
});
triggerDefinitionSchema.index(
  { business: 1, workflow: 1, eventType: 1, eventVersion: 1 },
  { unique: true }
);

export default (
  mongoose.models.TriggerDefinition ||
  mongoose.model("TriggerDefinition", triggerDefinitionSchema)
);
