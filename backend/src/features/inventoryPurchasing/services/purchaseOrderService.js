import mongoose from "mongoose";

import Product from "../../commerce/Product.js";

import PurchaseOrder from "../models/PurchaseOrder.js";
import Supplier from "../models/Supplier.js";
import SupplierProduct from "../models/SupplierProduct.js";
import {
  inventoryLocationFilter,
  resolveInventoryAuthority,
} from "./ownershipScope.js";

function createError(message, statusCode = 400, code = "PURCHASE_ORDER_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  error.code = code;
  return error;
}

function objectId(value, message = "Resource not found.", code = "RESOURCE_NOT_FOUND") {
  const text = String(value || "").trim();
  if (!mongoose.Types.ObjectId.isValid(text)) {
    throw createError(message, 404, code);
  }
  return new mongoose.Types.ObjectId(text);
}

function nextOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PO-${date}-${suffix}`;
}

function nextReceiptNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `GR-${date}-${suffix}`;
}

function stockField(product) {
  const candidates = ["stock", "stockQuantity", "quantity", "inventoryQuantity"];
  const source = product.toObject ? product.toObject() : product;
  return candidates.find((field) => Object.hasOwn(source, field)) || "stockQuantity";
}

function orderScope(effectiveAuthority) {
  return inventoryLocationFilter(effectiveAuthority);
}

function supplierScope(effectiveAuthority) {
  return inventoryLocationFilter(effectiveAuthority, { includeBusinessWide: true });
}

export async function createPurchaseOrder({
  supplierId,
  items,
  expectedDeliveryDate,
  notes,
  createdBy,
  effectiveAuthority,
}) {
  const authority = resolveInventoryAuthority(effectiveAuthority);
  if (!authority.selectedLocationId) {
    throw createError(
      "A selected Location is required to create a purchase order.",
      422,
      "PURCHASE_ORDER_LOCATION_REQUIRED"
    );
  }

  const supplierObjectId = objectId(
    supplierId,
    "The selected supplier is unavailable.",
    "SUPPLIER_NOT_FOUND"
  );

  const supplier = await Supplier.findOne({
    ...supplierScope(effectiveAuthority),
    _id: supplierObjectId,
    active: true,
  });

  if (!supplier) {
    throw createError(
      "The selected supplier is unavailable.",
      404,
      "SUPPLIER_NOT_FOUND"
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw createError(
      "At least one item is required.",
      422,
      "PURCHASE_ORDER_ITEMS_REQUIRED"
    );
  }

  const productIds = items.map((item) =>
    objectId(item?.product, "Product not found.", "PRODUCT_NOT_FOUND")
  );

  const products = await Product.find({
    ...orderScope(effectiveAuthority),
    _id: { $in: productIds },
  });

  const productMap = new Map(
    products.map((product) => [String(product._id), product])
  );

  const supplierProducts = await SupplierProduct.find({
    ...supplierScope(effectiveAuthority),
    supplier: supplierObjectId,
    product: { $in: productIds },
    active: true,
  });

  const supplierProductMap = new Map(
    supplierProducts.map((item) => [String(item.product), item])
  );

  const orderItems = items.map((item, index) => {
    const productId = productIds[index];
    const product = productMap.get(String(productId));
    if (!product) {
      throw createError("Product not found.", 404, "PRODUCT_NOT_FOUND");
    }

    const supplierProduct = supplierProductMap.get(String(productId));
    const orderedQuantity = Math.max(1, Number(item.orderedQuantity) || 1);
    const unitCost = Number(
      item.unitCost ?? supplierProduct?.unitCost ?? product.costPrice ?? product.cost ?? 0
    );

    return {
      product: product._id,
      supplierProduct: supplierProduct?._id,
      productName: product.name || product.title || "Product",
      sku: product.sku || supplierProduct?.supplierSku,
      orderedQuantity,
      unitCost: Number.isFinite(unitCost) ? Math.max(0, unitCost) : 0,
      vatRate: Math.min(
        100,
        Math.max(0, Number(item.vatRate ?? supplierProduct?.vatRate ?? 20) || 0)
      ),
    };
  });

  const order = await PurchaseOrder.create({
    business: authority.businessId,
    location: authority.selectedLocationId,
    orderNumber: nextOrderNumber(),
    supplier: supplierObjectId,
    items: orderItems,
    expectedDeliveryDate,
    notes,
    createdBy,
  });

  supplier.performance.totalOrders += 1;
  supplier.performance.lastOrderAt = new Date();
  await supplier.save();

  return order.populate([{ path: "supplier" }, { path: "items.product" }]);
}

async function findScopedOrder(purchaseOrderId, effectiveAuthority, session = null) {
  const orderId = objectId(
    purchaseOrderId,
    "Purchase order not found.",
    "PURCHASE_ORDER_NOT_FOUND"
  );
  let query = PurchaseOrder.findOne({
    ...orderScope(effectiveAuthority),
    _id: orderId,
  });
  if (session) query = query.session(session);
  return query;
}

export async function submitPurchaseOrder(purchaseOrderId, effectiveAuthority) {
  const order = await findScopedOrder(purchaseOrderId, effectiveAuthority);
  if (!order) {
    throw createError("Purchase order not found.", 404, "PURCHASE_ORDER_NOT_FOUND");
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
  approvedBy,
  effectiveAuthority
) {
  const order = await findScopedOrder(purchaseOrderId, effectiveAuthority);
  if (!order) {
    throw createError("Purchase order not found.", 404, "PURCHASE_ORDER_NOT_FOUND");
  }
  if (!["draft", "submitted"].includes(order.status)) {
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
  reason,
  effectiveAuthority
) {
  const order = await findScopedOrder(purchaseOrderId, effectiveAuthority);
  if (!order) {
    throw createError("Purchase order not found.", 404, "PURCHASE_ORDER_NOT_FOUND");
  }
  if (["received", "cancelled"].includes(order.status)) {
    throw createError(
      "This purchase order cannot be cancelled.",
      409,
      "INVALID_PURCHASE_ORDER_STATUS"
    );
  }
  order.status = "cancelled";
  order.cancelledAt = new Date();
  order.cancellationReason = String(reason || "Cancelled by management")
    .trim()
    .slice(0, 1000);
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
  effectiveAuthority,
}) {
  const session = await mongoose.startSession();

  try {
    let populatedOrder;

    await session.withTransaction(async () => {
      const order = await findScopedOrder(
        purchaseOrderId,
        effectiveAuthority,
        session
      );

      if (!order) {
        throw createError("Purchase order not found.", 404, "PURCHASE_ORDER_NOT_FOUND");
      }

      if (!["approved", "partially_received"].includes(order.status)) {
        throw createError(
          "Only approved purchase orders can be received.",
          409,
          "INVALID_PURCHASE_ORDER_STATUS"
        );
      }

      if (!Array.isArray(items) || items.length === 0) {
        throw createError(
          "At least one receipt item is required.",
          422,
          "RECEIPT_ITEMS_REQUIRED"
        );
      }

      const receiptItems = [];

      for (const receiptItem of items) {
        const orderItemId = String(receiptItem?.purchaseOrderItem || "").trim();
        if (!mongoose.Types.ObjectId.isValid(orderItemId)) {
          throw createError(
            "Purchase-order item not found.",
            404,
            "PURCHASE_ORDER_ITEM_NOT_FOUND"
          );
        }

        const orderItem = order.items.id(orderItemId);
        if (!orderItem) {
          throw createError(
            "Purchase-order item not found.",
            404,
            "PURCHASE_ORDER_ITEM_NOT_FOUND"
          );
        }

        const receivedQuantity = Math.max(0, Number(receiptItem.receivedQuantity) || 0);
        const damagedQuantity = Math.max(0, Number(receiptItem.damagedQuantity) || 0);
        const remaining = orderItem.orderedQuantity - orderItem.receivedQuantity;

        if (receivedQuantity + damagedQuantity > remaining) {
          throw createError(
            "Received and damaged quantities exceed the outstanding quantity.",
            422,
            "RECEIPT_QUANTITY_EXCEEDS_OUTSTANDING"
          );
        }

        orderItem.receivedQuantity += receivedQuantity;
        orderItem.damagedQuantity += damagedQuantity;

        if (receivedQuantity > 0) {
          const product = await Product.findOne({
            business: order.business,
            location: order.location,
            _id: orderItem.product,
          }).session(session);

          if (!product) {
            throw createError("Inventory product not found.", 404, "PRODUCT_NOT_FOUND");
          }

          const field = stockField(product);
          product[field] = Number(product[field] || 0) + receivedQuantity;
          await product.save({ session });
        }

        receiptItems.push({
          purchaseOrderItem: orderItem._id,
          product: orderItem.product,
          receivedQuantity,
          damagedQuantity,
          notes: String(receiptItem.notes || "").trim().slice(0, 1000),
        });
      }

      order.goodsReceipts.push({
        receiptNumber: nextReceiptNumber(),
        receivedAt,
        receivedBy,
        deliveryReference,
        supplierInvoiceReference,
        notes,
        items: receiptItems,
      });

      order.deliveryReference = deliveryReference || order.deliveryReference;
      order.supplierInvoiceReference =
        supplierInvoiceReference || order.supplierInvoiceReference;

      const complete = order.items.every(
        (item) =>
          item.receivedQuantity + item.damagedQuantity >= item.orderedQuantity
      );
      order.status = complete ? "received" : "partially_received";
      if (complete) order.receivedAt = new Date(receivedAt);
      await order.save({ session });

      const supplier = await Supplier.findOne({
        ...supplierScope(effectiveAuthority),
        _id: order.supplier,
      }).session(session);

      if (supplier) {
        const receivedUnits = receiptItems.reduce(
          (sum, item) => sum + item.receivedQuantity,
          0
        );
        const damagedUnits = receiptItems.reduce(
          (sum, item) => sum + item.damagedQuantity,
          0
        );

        supplier.performance.receivedUnits += receivedUnits;
        supplier.performance.damagedUnits += damagedUnits;
        supplier.performance.lastDeliveryAt = new Date(receivedAt);

        if (complete) {
          supplier.performance.completedOrders += 1;
          const delivered = new Date(receivedAt);
          const deliveryDays = Math.max(
            0,
            (delivered - new Date(order.createdAt)) / 86_400_000
          );
          const completedCount = supplier.performance.completedOrders;
          const previousAverage = supplier.performance.averageDeliveryDays;
          supplier.performance.averageDeliveryDays =
            (previousAverage * (completedCount - 1) + deliveryDays) / completedCount;

          if (order.expectedDeliveryDate && delivered > order.expectedDeliveryDate) {
            supplier.performance.lateDeliveries += 1;
          }
        }

        await supplier.save({ session });
      }

      populatedOrder = await PurchaseOrder.findOne({
        business: order.business,
        location: order.location,
        _id: order._id,
      })
        .populate("supplier")
        .populate("items.product")
        .session(session);
    });

    return populatedOrder;
  } finally {
    await session.endSession();
  }
}
