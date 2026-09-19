import mongoose from "mongoose";

const { Schema } = mongoose;

const aiInferenceLogSchema =
  new Schema(
    {
      capability: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      modelName: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      modelVersion: {
        type: String,
        required: true,
        trim: true,
      },
      featureVersion: {
        type: String,
        trim: true,
        default: "",
      },
      entityType: {
        type: String,
        trim: true,
        default: "",
        index: true,
      },
      entityKey: {
        type: String,
        trim: true,
        default: "",
        index: true,
      },
      requestedAt: {
        type: Date,
        default: Date.now,
        index: true,
      },
      latencyMs: {
        type: Number,
        min: 0,
        default: 0,
      },
      prediction: {
        type: Schema.Types.Mixed,
        default: {},
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: null,
      },
      explanation: {
        type: Schema.Types.Mixed,
        default: {},
      },
      outcome: {
        type: Schema.Types.Mixed,
        default: null,
      },
      outcomeObservedAt: {
        type: Date,
        default: null,
      },
      feedback: {
        rating: {
          type: Number,
          min: -1,
          max: 1,
          default: null,
        },
        useful: {
          type: Boolean,
          default: null,
        },
        comment: {
          type: String,
          trim: true,
          maxlength: 2000,
          default: "",
        },
        submittedAt: {
          type: Date,
          default: null,
        },
      },
      context: {
        requestId: {
          type: String,
          trim: true,
          default: "",
          index: true,
        },
        actorRole: {
          type: String,
          trim: true,
          default: "",
        },
        actorUserId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          default: null,
          index: true,
        },
        source: {
          type: String,
          trim: true,
          default: "",
        },
      },
    },
    {
      timestamps: true,
    }
  );

aiInferenceLogSchema.index({
  capability: 1,
  requestedAt: -1,
});

const AiInferenceLog =
  mongoose.models
    .AiInferenceLog ||
  mongoose.model(
    "AiInferenceLog",
    aiInferenceLogSchema
  );

export default AiInferenceLog;
