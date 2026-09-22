import mongoose from "mongoose";

const packageServiceSchema =
  new mongoose.Schema(
    {
      service: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "Service",
        required: true,
      },
      sessions: {
        type: Number,
        required: true,
        min: 1,
        max: 100,
      },
    },
    {
      _id: false,
    }
  );

const servicePackageSchema =
  new mongoose.Schema(
    {
      code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        unique: true,
        index: true,
        maxlength: 40,
      },
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
      },
      description: {
        type: String,
        trim: true,
        default: "",
        maxlength: 2000,
      },
      includedServices: {
        type: [
          packageServiceSchema,
        ],
        default: [],
        validate: {
          validator(items) {
            if (
              !Array.isArray(items) ||
              items.length === 0
            ) {
              return false;
            }

            const identifiers =
              items.map((item) =>
                String(item.service)
              );

            return (
              new Set(
                identifiers
              ).size ===
              identifiers.length
            );
          },
          message:
            "A service package must contain at least one unique service.",
        },
      },
      price: {
        type: Number,
        required: true,
        min: 0,
      },
      validityDays: {
        type: Number,
        required: true,
        min: 1,
        max: 3650,
        default: 365,
      },
      active: {
        type: Boolean,
        default: true,
        index: true,
      },
      published: {
        type: Boolean,
        default: false,
        index: true,
      },
      createdBy: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "User",
        default: null,
      },
      updatedBy: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "User",
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

servicePackageSchema.index({
  active: 1,
  published: 1,
  name: 1,
});

const ServicePackage =
  mongoose.models.ServicePackage ||
  mongoose.model(
    "ServicePackage",
    servicePackageSchema
  );

export default ServicePackage;
