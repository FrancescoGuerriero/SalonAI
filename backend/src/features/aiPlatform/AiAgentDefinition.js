import mongoose from "mongoose";
import {
  AI_AUTONOMY_LEVELS,
} from "./aiWorkforcePolicy.js";

const { Schema } = mongoose;

const aiAgentDefinitionSchema =
  new Schema(
    {
      key: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: 120,
        index: true,
      },
      version: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80,
      },
      displayName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
      },
      purpose: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000,
      },
      lifecycle: {
        type: String,
        enum: [
          "draft",
          "active",
          "retired",
        ],
        default: "draft",
        index: true,
      },
      allowedVerticals: {
        type: [String],
        default: [],
      },
      requiredEntitlement: {
        type: String,
        trim: true,
        maxlength: 160,
        default: "",
      },
      allowedTools: {
        type: [String],
        default: [],
      },
      autonomyCeiling: {
        type: String,
        enum:
          AI_AUTONOMY_LEVELS,
        default: "A0",
        index: true,
      },
      modelPolicy: {
        preferredModel: {
          type: String,
          trim: true,
          maxlength: 160,
          default: "",
        },
        fallbackModel: {
          type: String,
          trim: true,
          maxlength: 160,
          default: "",
        },
      },
      evaluationSuite: {
        key: {
          type: String,
          trim: true,
          maxlength: 160,
          default: "",
        },
        minimumTaskSuccessRate: {
          type: Number,
          min: 0,
          max: 1,
          default: null,
        },
        maximumPolicyViolationRate: {
          type: Number,
          min: 0,
          max: 1,
          default: 0,
        },
      },
      metadata: {
        type: Schema.Types.Mixed,
        default: {},
      },
    },
    {
      timestamps: true,
    }
  );

aiAgentDefinitionSchema.index(
  {
    key: 1,
    version: 1,
  },
  {
    unique: true,
  }
);

aiAgentDefinitionSchema.index({
  lifecycle: 1,
  key: 1,
  createdAt: -1,
});

const AiAgentDefinition =
  mongoose.models
    .AiAgentDefinition ||
  mongoose.model(
    "AiAgentDefinition",
    aiAgentDefinitionSchema
  );

export default AiAgentDefinition;
