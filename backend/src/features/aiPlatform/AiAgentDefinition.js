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
      groundingPolicy: {
        mode: {
          type: String,
          enum: [
            "canonical-tools-only",
            "knowledge-retrieval",
          ],
          default: "canonical-tools-only",
        },
        profileRequired: {
          type: Boolean,
          default: false,
        },
        citationsRequired: {
          type: Boolean,
          default: false,
        },
        allowedScopeModes: {
          type: [
            {
              type: String,
              enum: [
                "platform_global",
                "vertical",
                "tenant",
              ],
            },
          ],
          default: [],
        },
        allowedSourceTypes: {
          type: [String],
          default: [],
        },
        maxKnowledgeSources: {
          type: Number,
          min: 1,
          max: 12,
          default: 6,
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

aiAgentDefinitionSchema.pre(
  "validate",
  function validateGroundingPolicy() {
    const policy = this.groundingPolicy || {};
    if (policy.mode !== "knowledge-retrieval") {
      return;
    }

    if (policy.profileRequired !== true) {
      this.invalidate(
        "groundingPolicy.profileRequired",
        "Knowledge-grounded AI agents must resolve a governed tenant/vertical AI profile."
      );
    }
    if (policy.citationsRequired !== true) {
      this.invalidate(
        "groundingPolicy.citationsRequired",
        "Knowledge-grounded AI agents must require citations for grounded claims."
      );
    }
    if (!Array.isArray(policy.allowedScopeModes) || policy.allowedScopeModes.length === 0) {
      this.invalidate(
        "groundingPolicy.allowedScopeModes",
        "Knowledge-grounded AI agents require explicit knowledge scope modes."
      );
    }
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
