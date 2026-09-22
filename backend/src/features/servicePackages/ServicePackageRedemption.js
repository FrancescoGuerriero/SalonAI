import mongoose from "mongoose";

const servicePackageRedemptionSchema =
  new mongoose.Schema(
    {
      entitlement: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "CustomerServicePackage",
        required: true,
        index: true,
      },
      servicePackage: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "ServicePackage",
        required: true,
        index: true,
      },
      customer: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "Customer",
        required: true,
        index: true,
      },
      service: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "Service",
        required: true,
        index: true,
      },
      appointment: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "Appointment",
        required: true,
        index: true,
      },
      sessions: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
      },
      status: {
        type: String,
        enum: [
          "active",
          "reversed",
        ],
        default: "active",
        index: true,
      },
      redeemedBy: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "User",
        default: null,
      },
      redeemedAt: {
        type: Date,
        default: Date.now,
      },
      reversedBy: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "User",
        default: null,
      },
      reversedAt: {
        type: Date,
        default: null,
      },
      reversalReason: {
        type: String,
        trim: true,
        maxlength: 500,
        default: "",
      },
    },
    {
      timestamps: true,
    }
  );

servicePackageRedemptionSchema.index({
  entitlement: 1,
  status: 1,
  redeemedAt: -1,
});

servicePackageRedemptionSchema.index(
  {
    appointment: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: "active",
    },
  }
);

const ServicePackageRedemption =
  mongoose.models
    .ServicePackageRedemption ||
  mongoose.model(
    "ServicePackageRedemption",
    servicePackageRedemptionSchema
  );

export default ServicePackageRedemption;
