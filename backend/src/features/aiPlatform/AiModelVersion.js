import mongoose from "mongoose";

const { Schema } = mongoose;

const aiModelVersionSchema =
  new Schema(
    {
      name: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      version: {
        type: String,
        required: true,
        trim: true,
      },
      task: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      modelType: {
        type: String,
        enum: [
          "rules",
          "classification",
          "regression",
          "forecasting",
          "ranking",
          "embedding",
          "generative",
          "hybrid",
        ],
        required: true,
      },
      lifecycle: {
        type: String,
        enum: [
          "experiment",
          "candidate",
          "approved",
          "production",
          "retired",
        ],
        default: "experiment",
        index: true,
      },
      trainingDataset: {
        type: Schema.Types.ObjectId,
        ref: "AiTrainingDataset",
        default: null,
      },
      featureVersion: {
        type: String,
        trim: true,
        default: "",
      },
      algorithm: {
        type: String,
        trim: true,
        default: "",
      },
      artifactUri: {
        type: String,
        trim: true,
        default: "",
      },
      gitCommit: {
        type: String,
        trim: true,
        default: "",
      },
      metrics: {
        type: Schema.Types.Mixed,
        default: {},
      },
      thresholds: {
        type: Schema.Types.Mixed,
        default: {},
      },
      limitations: {
        type: [String],
        default: [],
      },
      approvedAt: {
        type: Date,
        default: null,
      },
      approvedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
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

aiModelVersionSchema.index(
  {
    name: 1,
    version: 1,
  },
  {
    unique: true,
  }
);

const AiModelVersion =
  mongoose.models
    .AiModelVersion ||
  mongoose.model(
    "AiModelVersion",
    aiModelVersionSchema
  );

export default AiModelVersion;
