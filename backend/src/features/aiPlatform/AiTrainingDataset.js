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
        },
        governanceBasis: {
          type: String,
          trim: true,
          maxlength: 1000,
          default: "",
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

aiTrainingDatasetSchema.pre(
  "validate",
  function validateDatasetScope(next) {
    const scope = this.scope || {};

    if (
      scope.mode === "single_business" &&
      !scope.business
    ) {
      this.invalidate(
        "scope.business",
        "single_business datasets require a trusted Business scope."
      );
    }

    if (
      scope.mode === "cross_business_deidentified"
    ) {
      if (scope.deidentified !== true) {
        this.invalidate(
          "scope.deidentified",
          "cross-business datasets must be de-identified."
        );
      }

      if (!String(scope.governanceBasis || "").trim()) {
        this.invalidate(
          "scope.governanceBasis",
          "cross-business datasets require an explicit governance basis."
        );
      }
    }

    next();
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

const AiTrainingDataset =
  mongoose.models
    .AiTrainingDataset ||
  mongoose.model(
    "AiTrainingDataset",
    aiTrainingDatasetSchema
  );

export default AiTrainingDataset;
