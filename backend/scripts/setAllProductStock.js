import "dotenv/config";

import mongoose from "mongoose";

import Product from "../src/features/commerce/Product.js";

const TARGET_STOCK = 2;
const CONFIRMATION = "SET_ALL_PRODUCT_STOCK_TO_2";

async function main() {
  if (process.argv[2] !== CONFIRMATION) {
    throw new Error(
      `Refusing to update inventory. Pass ${CONFIRMATION} as the first argument.`
    );
  }

  const mongoUri = String(process.env.MONGODB_URI || "").trim();

  if (!mongoUri) {
    throw new Error("MONGODB_URI is required.");
  }

  await mongoose.connect(mongoUri);

  try {
    const before = await Product.countDocuments({});
    const alreadyAtTarget = await Product.countDocuments({
      stockQuantity: TARGET_STOCK,
    });

    const result = await Product.updateMany(
      {},
      {
        $set: {
          stockQuantity: TARGET_STOCK,
        },
      }
    );

    const after = await Product.countDocuments({
      stockQuantity: TARGET_STOCK,
    });

    console.log(
      JSON.stringify(
        {
          success: true,
          targetStock: TARGET_STOCK,
          productsBefore: before,
          productsAlreadyAtTarget: alreadyAtTarget,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          productsAtTargetAfter: after,
        },
        null,
        2
      )
    );

    if (after !== before) {
      throw new Error(
        `Stock verification failed: ${after} of ${before} products are at ${TARGET_STOCK}.`
      );
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
