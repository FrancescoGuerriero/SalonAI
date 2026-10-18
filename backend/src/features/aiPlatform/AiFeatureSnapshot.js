import mongoose from "mongoose";

const { Schema } = mongoose;

const aiFeatureSnapshotSchema =
  new Schema(
    {
      business: {
        type: Schema.Types.ObjectId,
        ref: "Business",
        default: undefined,
        index: true,
        required() {
          return this.task === "no_show_prediction";
        },
      },
      location: {
        type: Schema.Types.ObjectId,
        ref: "Location",
        default: undefined,
        index: true,
      },
      vertical: {
        type: String,
        trim: true,
        default: "",
        index: true,
      },
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

// Preserve the pre-tenancy uniqueness contract during the additive provenance
// rollout. A later reviewed migration may tenant-localise uniqueness once all
// historical snapshots have trusted ownership.
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
  business: 1,
  location: 1,
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
