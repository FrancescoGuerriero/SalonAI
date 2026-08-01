import mongoose from "mongoose";

const supplierProductSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    supplierSku: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    supplierProductName: {
      type: String,
      trim: true,
      maxlength: 220,
    },
    unitCost: {
      type: Number,
      min: 0,
      required: true,
    },
    vatRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 20,
    },
    minimumOrderQuantity: {
      type: Number,
      min: 1,
      default: 1,
    },
    packSize: {
      type: Number,
      min: 1,
      default: 1,
    },
    leadTimeDays: {
      type: Number,
      min: 0,
      max: 365,
    },
    preferred: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastPurchasedAt: {
      type: Date,
    },
    lastPurchaseCost: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

supplierProductSchema.index(
  {
    supplier: 1,
    product: 1,
  },
  {
    unique: true,
  }
);

const SupplierProduct =
  mongoose.models.SupplierProduct ||
  mongoose.model(
    "SupplierProduct",
    supplierProductSchema
  );

export default SupplierProduct;
