import mongoose from "mongoose";

const {
  Schema,
} = mongoose;

const revenueForecastSnapshotSchema =
  new Schema(
    {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
      },

      description: {
        type: String,
        trim: true,
        default: "",
        maxlength: 2000,
      },

      generatedAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
      },

      createdBy: {
        type:
          Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
      },

      currency: {
        type: String,
        trim: true,
        uppercase: true,
        default: "GBP",
      },

      timezone: {
        type: String,
        trim: true,
        default:
          "Europe/London",
      },

      parameters: {
        type:
          Schema.Types.Mixed,
        default: {},
      },

      summary: {
        type:
          Schema.Types.Mixed,
        default: {},
      },

      methodology: {
        type:
          Schema.Types.Mixed,
        default: {},
      },

      insights: {
        type:
          Schema.Types.Mixed,
        default: {},
      },

      historicalRevenue: {
        type: [
          Schema.Types.Mixed,
        ],
        default: [],
      },

      bookedRevenue: {
        type: [
          Schema.Types.Mixed,
        ],
        default: [],
      },

      forecastRevenue: {
        type: [
          Schema.Types.Mixed,
        ],
        default: [],
      },
    },
    {
      timestamps: true,
    }
  );

revenueForecastSnapshotSchema.index({
  generatedAt: -1,
});

revenueForecastSnapshotSchema.index({
  createdBy: 1,
  generatedAt: -1,
});

const RevenueForecastSnapshot =
  mongoose.models
    .RevenueForecastSnapshot ||
  mongoose.model(
    "RevenueForecastSnapshot",
    revenueForecastSnapshotSchema
  );

export default RevenueForecastSnapshot;
