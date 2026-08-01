import mongoose from "mongoose";

import Product from "../../commerce/Product.js";

import PurchaseOrder from "../models/PurchaseOrder.js";
import Supplier from "../models/Supplier.js";
import SupplierProduct from "../models/SupplierProduct.js";


function createError(
  message,
  statusCode = 400,
  code = "PURCHASE_ORDER_ERROR"
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  error.code = code;
  return error;
}


function nextOrderNumber() {
  const now = new Date();
  const date = now
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");

  const suffix = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

  return `PO-${date}-${suffix}`;
}


function nextReceiptNumber() {
  const now = new Date();
  const date = now
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");

  const suffix = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

  return `GR-${date}-${suffix}`;
}


function stockField(product) {
  const candidates = [
    "stock",
    "stockQuantity",
    "quantity",
    "inventoryQuantity",
  ];

  return candidates.find(
    (field) =>
      Object.prototype.hasOwnProperty.call(
        product.toObject
          ? product.toObject()
          : product,
        field
      )
  ) || "stock";
}


export async function createPurchaseOrder({
  supplierId,
  items,
  expectedDeliveryDate,
  notes,
  createdBy,
}) {
  if (
    !mongoose.Types.ObjectId.isValid(
      supplierId
    )
  ) {
    throw createError(
      "A valid supplier is required.",
      422,
      "SUPPLIER_REQUIRED"
    );
  }

  const supplier =
    await Supplier.findById(
      supplierId
    );

  if (!supplier || !supplier.active) {
    throw createError(
      "The selected supplier is unavailable.",
      404,
      "SUPPLIER_NOT_FOUND"
    );
  }

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw createError(
      "At least one item is required.",
      422,
      "PURCHASE_ORDER_ITEMS_REQUIRED"
    );
  }

  const productIds = items.map(
    (item) => item.product
  );

  const products = await Product.find({
    _id: {
      $in: productIds,
    },
  });

  const productMap = new Map(
    products.map((product) => [
      String(product._id),
      product,
    ])
  );

  const supplierProducts =
    await SupplierProduct.find({
      supplier: supplierId,
      product: {
        $in: productIds,
      },
      active: true,
    });

  const supplierProductMap =
    new Map(
      supplierProducts.map(
        (item) => [
          String(item.product),
          item,
        ]
      )
    );

  const orderItems = items.map(
    (item) => {
      const product =
        productMap.get(
          String(item.product)
        );

      if (!product) {
        throw createError(
          `Product not found: ${item.product}`,
          404,
          "PRODUCT_NOT_FOUND"
        );
      }

      const supplierProduct =
        supplierProductMap.get(
          String(item.product)
        );

      const orderedQuantity =
        Math.max(
          1,
          Number(
            item.orderedQuantity
          ) || 1
        );

      const unitCost =
        Number(
          item.unitCost ??
          supplierProduct?.unitCost ??
          product.costPrice ??
          product.cost ??
          0
        );

      return {
        product: product._id,
        supplierProduct:
          supplierProduct?._id,
        productName:
          product.name ||
          product.title ||
          "Product",
        sku:
          product.sku ||
          supplierProduct?.supplierSku,
        orderedQuantity,
        unitCost,
        vatRate:
          Number(
            item.vatRate ??
            supplierProduct?.vatRate ??
            20
          ),
      };
    }
  );

  const order =
    await PurchaseOrder.create({
      orderNumber:
        nextOrderNumber(),
      supplier: supplierId,
      items: orderItems,
      expectedDeliveryDate,
      notes,
      createdBy,
    });

  supplier.performance.totalOrders += 1;
  supplier.performance.lastOrderAt =
    new Date();

  await supplier.save();

  return order.populate([
    {
      path: "supplier",
    },
    {
      path: "items.product",
    },
  ]);
}


export async function submitPurchaseOrder(
  purchaseOrderId
) {
  const order =
    await PurchaseOrder.findById(
      purchaseOrderId
    );

  if (!order) {
    throw createError(
      "Purchase order not found.",
      404,
      "PURCHASE_ORDER_NOT_FOUND"
    );
  }

  if (order.status !== "draft") {
    throw createError(
      "Only draft purchase orders can be submitted.",
      409,
      "INVALID_PURCHASE_ORDER_STATUS"
    );
  }

  order.status = "submitted";
  order.submittedAt = new Date();

  return order.save();
}


export async function approvePurchaseOrder(
  purchaseOrderId,
  approvedBy
) {
  const order =
    await PurchaseOrder.findById(
      purchaseOrderId
    );

  if (!order) {
    throw createError(
      "Purchase order not found.",
      404,
      "PURCHASE_ORDER_NOT_FOUND"
    );
  }

  if (
    ![
      "draft",
      "submitted",
    ].includes(order.status)
  ) {
    throw createError(
      "This purchase order cannot be approved.",
      409,
      "INVALID_PURCHASE_ORDER_STATUS"
    );
  }

  order.status = "approved";
  order.approvedAt = new Date();
  order.approvedBy = approvedBy;

  return order.save();
}


export async function cancelPurchaseOrder(
  purchaseOrderId,
  reason
) {
  const order =
    await PurchaseOrder.findById(
      purchaseOrderId
    );

  if (!order) {
    throw createError(
      "Purchase order not found.",
      404,
      "PURCHASE_ORDER_NOT_FOUND"
    );
  }

  if (
    [
      "received",
      "cancelled",
    ].includes(order.status)
  ) {
    throw createError(
      "This purchase order cannot be cancelled.",
      409,
      "INVALID_PURCHASE_ORDER_STATUS"
    );
  }

  order.status = "cancelled";
  order.cancelledAt = new Date();
  order.cancellationReason =
    reason || "Cancelled by management";

  return order.save();
}


export async function receivePurchaseOrder({
  purchaseOrderId,
  items,
  receivedBy,
  receivedAt = new Date(),
  deliveryReference,
  supplierInvoiceReference,
  notes,
}) {
  const session =
    await mongoose.startSession();

  try {
    let populatedOrder;

    await session.withTransaction(
      async () => {
        const order =
          await PurchaseOrder.findById(
            purchaseOrderId
          ).session(session);

        if (!order) {
          throw createError(
            "Purchase order not found.",
            404,
            "PURCHASE_ORDER_NOT_FOUND"
          );
        }

        if (
          ![
            "approved",
            "partially_received",
          ].includes(order.status)
        ) {
          throw createError(
            "Only approved purchase orders can be received.",
            409,
            "INVALID_PURCHASE_ORDER_STATUS"
          );
        }

        if (
          !Array.isArray(items) ||
          items.length === 0
        ) {
          throw createError(
            "At least one receipt item is required.",
            422,
            "RECEIPT_ITEMS_REQUIRED"
          );
        }

        const receiptItems = [];

        for (const receiptItem of items) {
          const orderItem =
            order.items.id(
              receiptItem.purchaseOrderItem
            );

          if (!orderItem) {
            throw createError(
              "Purchase-order item not found.",
              404,
              "PURCHASE_ORDER_ITEM_NOT_FOUND"
            );
          }

          const receivedQuantity =
            Math.max(
              0,
              Number(
                receiptItem.receivedQuantity
              ) || 0
            );

          const damagedQuantity =
            Math.max(
              0,
              Number(
                receiptItem.damagedQuantity
              ) || 0
            );

          const remaining =
            orderItem.orderedQuantity -
            orderItem.receivedQuantity;

          if (
            receivedQuantity +
            damagedQuantity >
            remaining
          ) {
            throw createError(
              "Received and damaged quantities exceed the outstanding quantity.",
              422,
              "RECEIPT_QUANTITY_EXCEEDS_OUTSTANDING"
            );
          }

          orderItem.receivedQuantity +=
            receivedQuantity;

          orderItem.damagedQuantity +=
            damagedQuantity;

          if (receivedQuantity > 0) {
            const product =
              await Product.findById(
                orderItem.product
              ).session(session);

            if (!product) {
              throw createError(
                "Inventory product not found.",
                404,
                "PRODUCT_NOT_FOUND"
              );
            }

            const field =
              stockField(product);

            product[field] =
              Number(product[field] || 0) +
              receivedQuantity;

            await product.save({
              session,
            });
          }

          receiptItems.push({
            purchaseOrderItem:
              orderItem._id,
            product:
              orderItem.product,
            receivedQuantity,
            damagedQuantity,
            notes:
              receiptItem.notes,
          });
        }

        order.goodsReceipts.push({
          receiptNumber:
            nextReceiptNumber(),
          receivedAt,
          receivedBy,
          deliveryReference,
          supplierInvoiceReference,
          notes,
          items: receiptItems,
        });

        order.deliveryReference =
          deliveryReference ||
          order.deliveryReference;

        order.supplierInvoiceReference =
          supplierInvoiceReference ||
          order.supplierInvoiceReference;

        const complete =
          order.items.every(
            (item) =>
              item.receivedQuantity +
              item.damagedQuantity >=
              item.orderedQuantity
          );

        order.status = complete
          ? "received"
          : "partially_received";

        if (complete) {
          order.receivedAt =
            new Date(receivedAt);
        }

        await order.save({
          session,
        });

        const supplier =
          await Supplier.findById(
            order.supplier
          ).session(session);

        if (supplier) {
          const receivedUnits =
            receiptItems.reduce(
              (sum, item) =>
                sum +
                item.receivedQuantity,
              0
            );

          const damagedUnits =
            receiptItems.reduce(
              (sum, item) =>
                sum +
                item.damagedQuantity,
              0
            );

          supplier.performance.receivedUnits +=
            receivedUnits;

          supplier.performance.damagedUnits +=
            damagedUnits;

          supplier.performance.lastDeliveryAt =
            new Date(receivedAt);

          if (complete) {
            supplier.performance.completedOrders += 1;

            const created =
              new Date(
                order.createdAt
              );

            const delivered =
              new Date(
                receivedAt
              );

            const deliveryDays =
              Math.max(
                0,
                (
                  delivered -
                  created
                ) /
                86_400_000
              );

            const completedCount =
              supplier.performance
                .completedOrders;

            const previousAverage =
              supplier.performance
                .averageDeliveryDays;

            supplier.performance.averageDeliveryDays =
              (
                previousAverage *
                (
                  completedCount -
                  1
                ) +
                deliveryDays
              ) /
              completedCount;

            if (
              order.expectedDeliveryDate &&
              delivered >
              order.expectedDeliveryDate
            ) {
              supplier.performance.lateDeliveries += 1;
            }
          }

          await supplier.save({
            session,
          });
        }

        populatedOrder =
          await PurchaseOrder.findById(
            order._id
          )
            .populate("supplier")
            .populate(
              "items.product"
            )
            .session(session);
      }
    );

    return populatedOrder;
  } finally {
    await session.endSession();
  }
}
