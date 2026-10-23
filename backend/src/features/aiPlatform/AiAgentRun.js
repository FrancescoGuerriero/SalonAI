import mongoose from "mongoose";
import {
  AI_AUTONOMY_LEVELS,
} from "./aiWorkforcePolicy.js";

const { Schema } = mongoose;

export const AI_AGENT_INITIATOR_TYPES = Object.freeze([
  "user",
  "customer_channel",
  "system",
]);

const aiAgentRunSchema =
  new Schema(
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
      agentDefinition: {
        type: Schema.Types.ObjectId,
        ref: "AiAgentDefinition",
        default: null,
        index: true,
      },
      agentKey: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: 120,
        index: true,
      },
      agentVersion: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80,
      },
      initiatorType: {
        type: String,
        enum: AI_AGENT_INITIATOR_TYPES,
        default: "user",
        required: true,
        index: true,
      },
      initiatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
        required() {
          return this.initiatorType === "user";
        },
        index: true,
      },
      customer: {
        type: Schema.Types.ObjectId,
        ref: "Customer",
        default: null,
        index: true,
      },
      channel: {
        type: String,
        enum: ["", "whatsapp", "web", "voice", "internal"],
        default: "",
        index: true,
      },
      channelConversationRef: {
        type: String,
        trim: true,
        default: "",
        maxlength: 180,
        required() {
          return this.initiatorType === "customer_channel";
        },
        index: true,
      },
      requestedAutonomy: {
        type: String,
        enum:
          AI_AUTONOMY_LEVELS,
        required: true,
        default: "A0",
      },
      effectiveAutonomy: {
        type: String,
        enum:
          AI_AUTONOMY_LEVELS,
        required: true,
        default: "A0",
      },
      modelName: {
        type: String,
        trim: true,
        maxlength: 160,
        default: "",
      },
      modelVersion: {
        type: String,
        trim: true,
        maxlength: 160,
        default: "",
      },
      status: {
        type: String,
        enum: [
          "started",
          "completed",
          "blocked",
          "failed",
        ],
        default: "started",
        index: true,
      },
      toolInvocations: {
        type: [
          {
            toolKey: {
              type: String,
              required: true,
              trim: true,
              maxlength: 160,
            },
            requiredPermission: {
              type: String,
              trim: true,
              maxlength: 160,
              default: "",
            },
            riskLevel: {
              type: String,
              enum: [
                "low",
                "medium",
                "high",
                "critical",
              ],
              default: "low",
            },
            status: {
              type: String,
              enum: [
                "allowed",
                "blocked",
                "completed",
                "failed",
              ],
              default: "allowed",
            },
            evidenceRefs: {
              type: [String],
              default: [],
            },
            startedAt: {
              type: Date,
              default: Date.now,
            },
            completedAt: {
              type: Date,
              default: null,
            },
            _id: false,
          },
        ],
        default: [],
      },
      proposalIds: {
        type: [
          {
            type: Schema.Types.ObjectId,
            ref: "AiActionProposal",
          },
        ],
        default: [],
      },
      startedAt: {
        type: Date,
        default: Date.now,
        index: true,
      },
      completedAt: {
        type: Date,
        default: null,
      },
      latencyMs: {
        type: Number,
        min: 0,
        default: null,
      },
      outcome: {
        taskSuccess: {
          type: Boolean,
          default: null,
        },
        humanApproved: {
          type: Boolean,
          default: null,
        },
        overridden: {
          type: Boolean,
          default: false,
        },
        reversed: {
          type: Boolean,
          default: false,
        },
        policyViolation: {
          type: Boolean,
          default: false,
        },
        businessMetricKey: {
          type: String,
          trim: true,
          maxlength: 160,
          default: "",
        },
        businessMetricDelta: {
          type: Number,
          default: null,
        },
      },
      requestId: {
        type: String,
        trim: true,
        maxlength: 160,
        default: "",
        index: true,
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

aiAgentRunSchema.index({
  business: 1,
  location: 1,
  agentKey: 1,
  startedAt: -1,
});

aiAgentRunSchema.index({
  business: 1,
  status: 1,
  startedAt: -1,
});

aiAgentRunSchema.index({
  business: 1,
  channel: 1,
  channelConversationRef: 1,
  startedAt: -1,
});

const AiAgentRun =
  mongoose.models
    .AiAgentRun ||
  mongoose.model(
    "AiAgentRun",
    aiAgentRunSchema
  );

export default AiAgentRun;
