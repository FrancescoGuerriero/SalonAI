import mongoose from "mongoose";

const { Schema } = mongoose;

const aiTrainingDatasetSchema =
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
      featureVersion: {
        type: String,
        required: true,
        trim: true,
      },
      status: {
        type: String,
        enum: [
          "draft",
          "frozen",
          "retired",
        ],
        default: "draft",
        index: true,
      },
      observationStart: {
        type: Date,
        default: null,
      },
      observationEnd: {
        type: Date,
        default: null,
      },
      snapshotCount: {
        type: Number,
        min: 0,
        default: 0,
      },
      splitStrategy: {
        type: {
          type: String,
          enum: [
            "temporal",
            "grouped_temporal",
            "manual",
          ],
          default: "temporal",
        },
        trainBefore: {
          type: Date,
          default: null,
        },
        validationBefore: {
          type: Date,
          default: null,
        },
      },
      schemaHash: {
        type: String,
        trim: true,
        default: "",
      },
      dataHash: {
        type: String,
        trim: true,
        default: "",
      },
      lineage: {
        sourceCollections: {
          type: [String],
          default: [],
        },
        builderVersion: {
          type: String,
          trim: true,
          default: "",
        },
        gitCommit: {
          type: String,
          trim: true,
          default: "",
        },
      },
      quality: {
        missingFeatureRates: {
          type: Schema.Types.Mixed,
          default: {},
        },
        labelDistribution: {
          type: Schema.Types.Mixed,
          default: {},
        },
        warnings: {
          type: [String],
          default: [],
        },
      },
      notes: {
        type: String,
        trim: true,
        maxlength: 4000,
        default: "",
      },
    },
    {
      timestamps: true,
    }
  );

aiTrainingDatasetSchema.index(
  {
    name: 1,
    version: 1,
  },
  {
    unique: true,
  }
);

const AiTrainingDataset =
  mongoose.models
    .AiTrainingDataset ||
  mongoose.model(
    "AiTrainingDataset",
    aiTrainingDatasetSchema
  );

export default AiTrainingDataset;
