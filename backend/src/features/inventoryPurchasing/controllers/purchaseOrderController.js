import PurchaseOrder from "../models/PurchaseOrder.js";

import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  receivePurchaseOrder,
  submitPurchaseOrder,
} from "../services/purchaseOrderService.js";


export async function listPurchaseOrders(
  request,
  response
) {
  const query = {};

  if (request.query.status) {
    query.status =
      request.query.status;
  }

  if (request.query.supplier) {
    query.supplier =
      request.query.supplier;
  }

  const orders =
    await PurchaseOrder.find(query)
      .populate("supplier")
      .sort({
        createdAt: -1,
      })
      .lean();

  response.status(200).json({
    success: true,
    purchaseOrders: orders,
  });
}


export async function getPurchaseOrder(
  request,
  response
) {
  const purchaseOrder =
    await PurchaseOrder.findById(
      request.params.purchaseOrderId
    )
      .populate("supplier")
      .populate("items.product")
      .populate("approvedBy")
      .populate(
        "goodsReceipts.receivedBy"
      );

  if (!purchaseOrder) {
    const error = new Error(
      "Purchase order not found."
    );

    error.statusCode = 404;
    throw error;
  }

  response.status(200).json({
    success: true,
    purchaseOrder,
  });
}


export async function createPurchaseOrderHandler(
  request,
  response
) {
  const purchaseOrder =
    await createPurchaseOrder({
      ...request.body,
      createdBy:
        request.user?._id,
    });

  response.status(201).json({
    success: true,
    purchaseOrder,
  });
}


export async function updatePurchaseOrder(
  request,
  response
) {
  const current =
    await PurchaseOrder.findById(
      request.params.purchaseOrderId
    );

  if (!current) {
    const error = new Error(
      "Purchase order not found."
    );

    error.statusCode = 404;
    throw error;
  }

  if (current.status !== "draft") {
    const error = new Error(
      "Only draft purchase orders can be edited."
    );

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
    if (
      request.body[field] !==
      undefined
    ) {
      current[field] =
        request.body[field];
    }
  }

  await current.save();

  response.status(200).json({
    success: true,
    purchaseOrder: current,
  });
}


export async function submitPurchaseOrderHandler(
  request,
  response
) {
  const purchaseOrder =
    await submitPurchaseOrder(
      request.params.purchaseOrderId
    );

  response.status(200).json({
    success: true,
    purchaseOrder,
  });
}


export async function approvePurchaseOrderHandler(
  request,
  response
) {
  const purchaseOrder =
    await approvePurchaseOrder(
      request.params.purchaseOrderId,
      request.user?._id
    );

  response.status(200).json({
    success: true,
    purchaseOrder,
  });
}


export async function cancelPurchaseOrderHandler(
  request,
  response
) {
  const purchaseOrder =
    await cancelPurchaseOrder(
      request.params.purchaseOrderId,
      request.body.reason
    );

  response.status(200).json({
    success: true,
    purchaseOrder,
  });
}


export async function receivePurchaseOrderHandler(
  request,
  response
) {
  const purchaseOrder =
    await receivePurchaseOrder({
      purchaseOrderId:
        request.params.purchaseOrderId,
      ...request.body,
      receivedBy:
        request.user?._id,
    });

  response.status(200).json({
    success: true,
    purchaseOrder,
  });
}
