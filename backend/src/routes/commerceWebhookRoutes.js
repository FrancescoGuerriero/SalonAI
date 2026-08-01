import mongoose from "mongoose";

const inventoryAdjustmentSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    delta: { type: Number, required: true },
    previousQuantity: { type: Number, required: true, min: 0 },
    newQuantity: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    reference: { type: String, trim: true, default: "", maxlength: 150 },
    adjustedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const InventoryAdjustment =
  mongoose.models.InventoryAdjustment ||
  mongoose.model("InventoryAdjustment", inventoryAdjustmentSchema);

export default InventoryAdjustment;
