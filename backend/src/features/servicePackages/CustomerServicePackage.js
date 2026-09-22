import mongoose from "mongoose";

const entitlementCreditSchema =
  new mongoose.Schema(
    {
      service: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "Service",
        required: true,
      },
      purchased: {
        type: Number,
        required: true,
        min: 1,
      },
      remaining: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    {
      _id: false,
    }
  );

const customerServicePackageSchema =
  new mongoose.Schema(
    {
      customer: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "Customer",
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
      credits: {
        type: [
          entitlementCreditSchema,
        ],
        default: [],
        validate: {
          validator(items) {
            return (
              Array.isArray(items) &&
              items.length > 0
            );
          },
          message:
            "A customer package must contain at least one service credit.",
        },
      },
      validFrom: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
      },
      expiresAt: {
        type: Date,
        required: true,
        index: true,
      },
      status: {
        type: String,
        enum: [
          "active",
          "exhausted",
          "expired",
          "cancelled",
        ],
        default: "active",
        index: true,
      },
      source: {
        type: String,
        enum: [
          "manual",
          "order",
          "migration",
        ],
        required: true,
        default: "manual",
      },
      order: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "Order",
        default: null,
        index: true,
      },
      payment: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "Payment",
        default: null,
      },
      grantedPrice: {
        type: Number,
        min: 0,
        default: 0,
      },
      grantReason: {
        type: String,
        trim: true,
        maxlength: 500,
        default: "",
      },
      assignedBy: {
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

customerServicePackageSchema.index({
  customer: 1,
  status: 1,
  expiresAt: 1,
});

const CustomerServicePackage =
  mongoose.models
    .CustomerServicePackage ||
  mongoose.model(
    "CustomerServicePackage",
    customerServicePackageSchema
  );

export default CustomerServicePackage;
