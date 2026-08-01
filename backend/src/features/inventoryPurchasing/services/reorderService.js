import Product from "../../commerce/Product.js";

import PurchaseOrder from "../models/PurchaseOrder.js";
import SupplierProduct from "../models/SupplierProduct.js";


function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}


function readStock(product) {
  return number(
    product.stock ??
    product.stockQuantity ??
    product.quantity ??
    product.inventoryQuantity,
    0
  );
}


function readReorderLevel(product) {
  return number(
    product.reorderLevel ??
    product.lowStockThreshold ??
    product.minimumStock ??
    0,
    0
  );
}


function readTargetStock(product) {
  return number(
    product.targetStock ??
    product.reorderQuantity ??
    product.maximumStock ??
    readReorderLevel(product) * 2,
    readReorderLevel(product) * 2
  );
}


export async function getReorderRecommendations() {
  const products =
    await Product.find({
      active: {
        $ne: false,
      },
    }).lean();

  const productIds =
    products.map(
      (product) => product._id
    );

  const supplierProducts =
    await SupplierProduct.find({
      product: {
        $in: productIds,
      },
      active: true,
    })
      .populate("supplier")
      .lean();

  const openOrders =
    await PurchaseOrder.find({
      status: {
        $in: [
          "draft",
          "submitted",
          "approved",
          "partially_received",
        ],
      },
      "items.product": {
        $in: productIds,
      },
    }).lean();

  const incomingByProduct =
    new Map();

  for (const order of openOrders) {
    for (const item of order.items || []) {
      const key =
        String(item.product);

      const outstanding =
        Math.max(
          0,
          number(
            item.orderedQuantity
          ) -
          number(
            item.receivedQuantity
          ) -
          number(
            item.damagedQuantity
          )
        );

      incomingByProduct.set(
        key,
        (
          incomingByProduct.get(
            key
          ) || 0
        ) + outstanding
      );
    }
  }

  const suppliersByProduct =
    new Map();

  for (
    const item of
    supplierProducts
  ) {
    const key =
      String(item.product);

    if (
      !suppliersByProduct.has(
        key
      )
    ) {
      suppliersByProduct.set(
        key,
        []
      );
    }

    suppliersByProduct
      .get(key)
      .push(item);
  }

  return products
    .map((product) => {
      const key =
        String(product._id);

      const currentStock =
        readStock(product);

      const reorderLevel =
        readReorderLevel(
          product
        );

      const incomingStock =
        incomingByProduct.get(
          key
        ) || 0;

      const availableAfterIncoming =
        currentStock +
        incomingStock;

      const targetStock =
        Math.max(
          reorderLevel,
          readTargetStock(
            product
          )
        );

      const recommendedQuantity =
        Math.max(
          0,
          targetStock -
          availableAfterIncoming
        );

      const suppliers =
        suppliersByProduct.get(
          key
        ) || [];

      suppliers.sort(
        (left, right) =>
          Number(
            right.preferred
          ) -
          Number(
            left.preferred
          ) ||
          number(left.unitCost) -
          number(right.unitCost)
      );

      return {
        product: {
          _id: product._id,
          name:
            product.name ||
            product.title,
          sku: product.sku,
        },
        currentStock,
        incomingStock,
        reorderLevel,
        targetStock,
        recommendedQuantity,
        needsReorder:
          recommendedQuantity > 0 &&
          currentStock <= reorderLevel,
        preferredSupplier:
          suppliers[0]?.supplier ||
          null,
        preferredSupplierProduct:
          suppliers[0] ||
          null,
      };
    })
    .filter(
      (item) =>
        item.needsReorder
    )
    .sort(
      (left, right) =>
        right.recommendedQuantity -
        left.recommendedQuantity
    );
}
