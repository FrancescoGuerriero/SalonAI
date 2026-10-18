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
      scope: {
        mode: {
          type: String,
          enum: [
            "unassigned",
            "single_business",
            "cross_business_deidentified",
            "platform_global",
          ],
          default: "unassigned",
          index: true,
        },
        business: {
          type: Schema.Types.ObjectId,
          ref: "Business",
          default: null,
          index: true,
        },
        location: {
          type: Schema.Types.ObjectId,
          ref: "Location",
          default: null,
          index: true,
        },
        verticalId: {
          type: String,
          trim: true,
          default: "",
          index: true,
        },
        source: {
          type: String,
          enum: [
            "legacy_unassigned",
            "trusted_runtime",
            "governed_builder",
          ],
          default: "legacy_unassigned",
        },
        crossBusinessApproved: {
          type: Boolean,
          default: false,
        },
        approvalReference: {
          type: String,
          trim: true,
          default: "",
          maxlength: 500,
        },
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
        splitLabelDistribution: {
          type: Schema.Types.Mixed,
          default: {},
        },
        readiness: {
          readyToFreeze: {
            type: Boolean,
            default: false,
          },
          blockers: {
            type: [String],
            default: [],
          },
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

aiTrainingDatasetSchema.index({
  "scope.business": 1,
  task: 1,
  status: 1,
  createdAt: -1,
});

aiTrainingDatasetSchema.index({
  "scope.verticalId": 1,
  task: 1,
  status: 1,
  createdAt: -1,
});

const AiTrainingDataset =
  mongoose.models
    .AiTrainingDataset ||
  mongoose.model(
    "AiTrainingDataset",
    aiTrainingDatasetSchema
  );

export default AiTrainingDataset;
