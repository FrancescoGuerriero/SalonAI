import mongoose from "mongoose";

const { Schema } = mongoose;

const aiFeatureSnapshotSchema =
  new Schema(
    {
      task: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      entityType: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      entityKey: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      tenant: {
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
      },
      asOf: {
        type: Date,
        required: true,
        index: true,
      },
      featureVersion: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      datasetVersion: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      features: {
        type: Schema.Types.Mixed,
        required: true,
        default: {},
      },
      label: {
        type: Schema.Types.Mixed,
        default: null,
      },
      labelObservedAt: {
        type: Date,
        default: null,
      },
      split: {
        type: String,
        enum: [
          "unassigned",
          "train",
          "validation",
          "test",
        ],
        default: "unassigned",
        index: true,
      },
      sourceRefs: {
        type: [
          {
            collection: {
              type: String,
              trim: true,
              required: true,
            },
            documentId: {
              type: String,
              trim: true,
              required: true,
            },
            _id: false,
          },
        ],
        default: [],
      },
      privacy: {
        containsDirectIdentifiers: {
          type: Boolean,
          default: false,
        },
        pseudonymised: {
          type: Boolean,
          default: true,
        },
        purpose: {
          type: String,
          trim: true,
          default:
            "model_training_and_evaluation",
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

aiFeatureSnapshotSchema.index(
  {
    task: 1,
    entityType: 1,
    entityKey: 1,
    asOf: 1,
    featureVersion: 1,
    datasetVersion: 1,
  },
  {
    unique: true,
  }
);

aiFeatureSnapshotSchema.index({
  "tenant.business": 1,
  task: 1,
  asOf: -1,
});

aiFeatureSnapshotSchema.index({
  "tenant.location": 1,
  task: 1,
  asOf: -1,
});

const AiFeatureSnapshot =
  mongoose.models
    .AiFeatureSnapshot ||
  mongoose.model(
    "AiFeatureSnapshot",
    aiFeatureSnapshotSchema
  );

export default AiFeatureSnapshot;
