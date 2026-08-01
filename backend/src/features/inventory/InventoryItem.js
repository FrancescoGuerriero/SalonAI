import mongoose from "mongoose";

const { Schema } = mongoose;

const inventoryItemSchema = new Schema(
  {
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: "General",
    },
    supplier: {
      type: String,
      trim: true,
      default: "",
    },
    unit: {
      type: String,
      trim: true,
      default: "unit",
    },
    quantityOnHand: {
      type: Number,
      min: 0,
      default: 0,
    },
    reorderPoint: {
      type: Number,
      min: 0,
      default: 5,
    },
    reorderQuantity: {
      type: Number,
      min: 0,
      default: 10,
    },
    averageDailyUsage: {
      type: Number,
      min: 0,
      default: 0,
    },
    leadTimeDays: {
      type: Number,
      min: 0,
      max: 365,
      default: 7,
    },
    unitCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    retailPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastRestockedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const InventoryItem =
  mongoose.models.InventoryItem ||
  mongoose.model("InventoryItem", inventoryItemSchema);

export default InventoryItem;
