import mongoose from "mongoose";

import PurchaseOrder from "../models/PurchaseOrder.js";

import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  receivePurchaseOrder,
  submitPurchaseOrder,
} from "../services/purchaseOrderService.js";
import { inventoryLocationFilter } from "../services/ownershipScope.js";

function notFound() {
  const error = new Error("Purchase order not found.");
  error.statusCode = 404;
  return error;
}

function objectId(value) {
  const text = String(value || "").trim();
  if (!mongoose.Types.ObjectId.isValid(text)) throw notFound();
  return new mongoose.Types.ObjectId(text);
}

function orderScope(request) {
  return inventoryLocationFilter(request.effectiveAuthority);
}

export async function listPurchaseOrders(request, response) {
  const query = { ...orderScope(request) };

  if (request.query.status) {
    const status = String(request.query.status).trim();
    const allowedStatuses = new Set([
      "draft",
      "submitted",
      "approved",
      "partially_received",
      "received",
      "cancelled",
    ]);
    if (!allowedStatuses.has(status)) {
      const error = new Error("Unsupported purchase-order status.");
      error.statusCode = 422;
      throw error;
    }
    query.status = status;
  }

  if (request.query.supplier) {
    query.supplier = objectId(request.query.supplier);
  }

  const orders = await PurchaseOrder.find(query)
    .populate("supplier")
    .sort({ createdAt: -1 })
    .lean();

  response.status(200).json({
    success: true,
    purchaseOrders: orders,
  });
}

export async function getPurchaseOrder(request, response) {
  const purchaseOrder = await PurchaseOrder.findOne({
    ...orderScope(request),
    _id: objectId(request.params.purchaseOrderId),
  })
    .populate("supplier")
    .populate("items.product")
    .populate("approvedBy")
    .populate("goodsReceipts.receivedBy");

  if (!purchaseOrder) throw notFound();

  response.status(200).json({
    success: true,
    purchaseOrder,
  });
}

export async function createPurchaseOrderHandler(request, response) {
  const purchaseOrder = await createPurchaseOrder({
    ...request.body,
    createdBy: request.user?._id,
    effectiveAuthority: request.effectiveAuthority,
  });

  response.status(201).json({
    success: true,
    purchaseOrder,
  });
}

export async function updatePurchaseOrder(request, response) {
  const current = await PurchaseOrder.findOne({
    ...orderScope(request),
    _id: objectId(request.params.purchaseOrderId),
  });

  if (!current) throw notFound();

  if (current.status !== "draft") {
    const error = new Error("Only draft purchase orders can be edited.");
    error.statusCode = 409;
    throw error;
  }

  const allowed = [
    "items",
    "expectedDeliveryDate",
    "notes",
    "supplierInvoiceReference",
    "deliveryReference",
  ];

  for (const field of allowed) {
    if (request.body[field] !== undefined) current[field] = request.body[field];
  }

  await current.save();

  response.status(200).json({
    success: true,
    purchaseOrder: current,
  });
}

export async function submitPurchaseOrderHandler(request, response) {
  const purchaseOrder = await submitPurchaseOrder(
    request.params.purchaseOrderId,
    request.effectiveAuthority
  );

  response.status(200).json({ success: true, purchaseOrder });
}

export async function approvePurchaseOrderHandler(request, response) {
  const purchaseOrder = await approvePurchaseOrder(
    request.params.purchaseOrderId,
    request.user?._id,
    request.effectiveAuthority
  );

  response.status(200).json({ success: true, purchaseOrder });
}

export async function cancelPurchaseOrderHandler(request, response) {
  const purchaseOrder = await cancelPurchaseOrder(
    request.params.purchaseOrderId,
    request.body.reason,
    request.effectiveAuthority
  );

  response.status(200).json({ success: true, purchaseOrder });
}

export async function receivePurchaseOrderHandler(request, response) {
  const purchaseOrder = await receivePurchaseOrder({
    ...request.body,
    purchaseOrderId: request.params.purchaseOrderId,
    receivedBy: request.user?._id,
    effectiveAuthority: request.effectiveAuthority,
  });

  response.status(200).json({ success: true, purchaseOrder });
}
