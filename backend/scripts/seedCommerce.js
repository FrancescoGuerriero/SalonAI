import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "../src/config/db.js";
import Product from "../src/features/commerce/Product.js";

const products = [
  {
    name: "Hydrating Repair Shampoo",
    slug: "hydrating-repair-shampoo",
    sku: "SA-SHAMPOO-001",
    brand: "SalonAI Professional",
    description: "A gentle sulphate-free shampoo for dry, coloured and heat-styled hair.",
    category: "Shampoo",
    size: "300 ml",
    price: 18.5,
    costPrice: 7.2,
    stockQuantity: 24,
    reorderLevel: 6,
    featured: true,
    active: true,
  },
  {
    name: "Strengthening Conditioner",
    slug: "strengthening-conditioner",
    sku: "SA-COND-001",
    brand: "SalonAI Professional",
    description: "A smoothing conditioner formulated to improve softness and manageability.",
    category: "Conditioner",
    size: "300 ml",
    price: 19.5,
    costPrice: 7.8,
    stockQuantity: 20,
    reorderLevel: 6,
    featured: true,
    active: true,
  },
  {
    name: "Heat Defence Spray",
    slug: "heat-defence-spray",
    sku: "SA-STYLING-001",
    brand: "SalonAI Professional",
    description: "Lightweight thermal protection for blow-drying, straightening and curling.",
    category: "Styling",
    size: "200 ml",
    price: 16,
    costPrice: 5.9,
    stockQuantity: 18,
    reorderLevel: 5,
    featured: false,
    active: true,
  },
  {
    name: "Nourishing Hair Mask",
    slug: "nourishing-hair-mask",
    sku: "SA-TREAT-001",
    brand: "SalonAI Professional",
    description: "A weekly intensive mask for moisture, shine and reduced breakage.",
    category: "Treatment",
    size: "250 ml",
    price: 24,
    costPrice: 9.5,
    stockQuantity: 14,
    reorderLevel: 4,
    featured: true,
    active: true,
  },
];

try {
  await connectDB();
  for (const product of products) {
    await Product.findOneAndUpdate(
      { sku: product.sku },
      { $set: product },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log(`Seeded ${products.length} commerce products.`);
} finally {
  await mongoose.disconnect();
}
