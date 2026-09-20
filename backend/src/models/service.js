import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    priceLabel: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    priceOnConsultation: {
      type: Boolean,
      default: false,
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
    },
    durationEstimated: {
      type: Boolean,
      default: false,
    },
    bookable: {
      type: Boolean,
      default: undefined,
    },
    published: {
      type: Boolean,
      default: undefined,
    },
    // Transitional read-only compatibility for records created before
    // the platform-wide `bookable` field. New writes never use this field.
    onlineBookable: {
      type: Boolean,
      default: undefined,
      select: false,
    },
    image: {
      type: String,
      trim: true,
      default: "",
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default (
  mongoose.models.Service ||
  mongoose.model("Service", serviceSchema)
);
