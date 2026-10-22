import mongoose from "mongoose";

const { Schema } = mongoose;

const integrationRateLimitBucketSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    app: {
      type: Schema.Types.ObjectId,
      ref: "IntegrationApp",
      required: true,
      index: true,
    },
    endpointKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    windowStart: {
      type: Date,
      required: true,
      index: true,
    },
    count: {
      type: Number,
      min: 0,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: false,
  }
);

integrationRateLimitBucketSchema.index(
  {
    business: 1,
    app: 1,
    endpointKey: 1,
    windowStart: 1,
  },
  { unique: true }
);

export default (
  mongoose.models.IntegrationRateLimitBucket ||
  mongoose.model(
    "IntegrationRateLimitBucket",
    integrationRateLimitBucketSchema
  )
);
