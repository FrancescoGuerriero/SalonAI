import mongoose from "mongoose";

import { RESOURCE_KINDS } from "./ServiceSequence.js";

const { Schema } = mongoose;

const bookingResourceSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      default: undefined,
      index: true,
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: RESOURCE_KINDS,
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      max: 1000,
      default: 1,
      validate: {
        validator: Number.isInteger,
        message: "Booking resource capacity must be an integer.",
      },
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

bookingResourceSchema.index(
  {
    business: 1,
    location: 1,
    kind: 1,
    key: 1,
  },
  {
    unique: true,
  }
);

export default (
  mongoose.models.BookingResource ||
  mongoose.model("BookingResource", bookingResourceSchema)
);
