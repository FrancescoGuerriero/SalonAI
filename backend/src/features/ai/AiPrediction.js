import mongoose from "mongoose";

const aiPredictionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    predictionType: {
      type: String,
      enum: [
        "churn_risk",
        "return_probability",
        "recommended_channel",
        "recommended_campaign",
        "service_recommendation",
      ],
      required: true,
      index: true,
    },
    score: {
      type: Number,
      min: 0,
      max: 1,
    },
    label: {
      type: String,
      trim: true,
    },
    explanation: {
      type: String,
      maxlength: 3000,
    },
    modelName: {
      type: String,
      required: true,
    },
    modelVersion: {
      type: String,
      default: "1",
    },
    features: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const AiPrediction =
  mongoose.models.AiPrediction ||
  mongoose.model(
    "AiPrediction",
    aiPredictionSchema
  );

export default AiPrediction;
