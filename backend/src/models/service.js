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
    onlineBookable: {
      type: Boolean,
      default: true,
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
