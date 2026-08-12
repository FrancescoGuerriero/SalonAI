import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      default: "SalonAI",
      maxlength: 120,
    },
    description: {
      type: String,
      maxlength: 3000,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      index: true,
      default: "Haircare",
    },
    collectionName: {
      type: String,
      trim: true,
      index: true,
      default: "",
      maxlength: 120,
    },
    badge: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    size: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    costPrice: {
      type: Number,
      min: 0,
      default: 0,
      select: false,
    },
    stockQuantity: {
      type: Number,
      min: 0,
      default: 0,
      index: true,
    },
    reorderLevel: {
      type: Number,
      min: 0,
      default: 5,
    },
    images: {
      type: [String],
      default: [],
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

productSchema.virtual("inStock").get(function inStock() {
  return this.active && this.stockQuantity > 0;
});

productSchema.virtual("lowStock").get(function lowStock() {
  return this.stockQuantity <= this.reorderLevel;
});

const Product =
  mongoose.models.Product ||
  mongoose.model("Product", productSchema);

export default Product;
