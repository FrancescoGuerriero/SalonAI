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
            "single_business",
            "cross_business_deidentified",
            "platform_global",
          ],
          default: "single_business",
          index: true,
        },
        business: {
          type: Schema.Types.ObjectId,
          ref: "Business",
          default: undefined,
          index: true,
        },
        locations: {
          type: [
            {
              type: Schema.Types.ObjectId,
              ref: "Location",
            },
          ],
          default: [],
        },
        verticals: {
          type: [String],
          default: [],
        },
        deidentified: {
          type: Boolean,
          default: true,
          validate: {
            validator(value) {
              return (
                this.scope?.mode !== "cross_business_deidentified" ||
                value === true
              );
            },
            message:
              "cross-business datasets must be de-identified.",
          },
        },
        governanceBasis: {
          type: String,
          trim: true,
          maxlength: 1000,
          default: "",
          required() {
            return this.scope?.mode === "cross_business_deidentified";
          },
        },
      },
      trainingContext: {
        layer: {
          type: String,
          enum: [
            "general",
            "vertical",
            "tenant",
            "continuous-ml",
          ],
          default: undefined,
          index: true,
        },
        profileKey: {
          type: String,
          trim: true,
          default: "",
          index: true,
        },
        tenantBlueprintKey: {
          type: String,
          trim: true,
          default: "",
          index: true,
        },
        productionTrainingAuthorized: {
          type: Boolean,
          default: false,
        },
        automaticPromotionAuthorized: {
          type: Boolean,
          default: false,
        },
        automaticInferenceActivationAuthorized: {
          type: Boolean,
          default: false,
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
  "scope.mode": 1,
  "scope.business": 1,
  task: 1,
  status: 1,
});

aiTrainingDatasetSchema.index({
  "trainingContext.profileKey": 1,
  "trainingContext.layer": 1,
  task: 1,
  status: 1,
});

const AiTrainingDataset =
  mongoose.models
    .AiTrainingDataset ||
  mongoose.model(
    "AiTrainingDataset",
    aiTrainingDatasetSchema
  );

export default AiTrainingDataset;
