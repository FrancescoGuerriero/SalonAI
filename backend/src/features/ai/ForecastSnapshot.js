import mongoose from "mongoose";

const forecastPointSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    predictedRevenue: {
      type: Number,
      default: 0,
    },
    predictedAppointments: {
      type: Number,
      default: 0,
    },
    lowerBound: Number,
    upperBound: Number,
  },
  {
    _id: false,
  }
);

const forecastSnapshotSchema =
  new mongoose.Schema(
    {
      period: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
        default: "daily",
      },
      horizonDays: {
        type: Number,
        default: 30,
      },
      generatedAt: {
        type: Date,
        default: Date.now,
        index: true,
      },
      modelName: {
        type: String,
        default: "moving-average-baseline",
      },
      points: {
        type: [forecastPointSchema],
        default: [],
      },
      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    {
      timestamps: true,
    }
  );

const ForecastSnapshot =
  mongoose.models.ForecastSnapshot ||
  mongoose.model(
    "ForecastSnapshot",
    forecastSnapshotSchema
  );

export default ForecastSnapshot;
