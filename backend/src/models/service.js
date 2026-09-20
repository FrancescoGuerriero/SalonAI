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

    // Global AI Business Platform service states.
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    published: {
      type: Boolean,
      default: undefined,
      index: true,
    },
    bookable: {
      type: Boolean,
      default: undefined,
      index: true,
    },

    // Transitional persistence only. New API/UI code must use "bookable".
    // This field is hidden and will be removed after the governed data migration.
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
  },
  {
    timestamps: true,
  }
);

export default (
  mongoose.models.Service ||
  mongoose.model("Service", serviceSchema)
);
