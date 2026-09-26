import * as service from "./commerceService.js";
import { refundOrder } from "./orderRefundService.js";
import {
  hasRequestPermission,
} from "../../middleware/permissionMiddleware.js";

export function getCommerceConfig(req, res) {
  res.json(service.commerceConfig());
}

export async function createProduct(req, res) {
  res.status(201).json(
    await service.createProduct({
      ...req.body,
      stockQuantity:
        hasRequestPermission(
          req,
          "product:inventory:update"
        )
          ? req.body.stockQuantity
          : 0,
      reorderLevel:
        hasRequestPermission(
          req,
          "product:inventory:update"
        )
          ? req.body.reorderLevel
          : 5,
      active: false,
    })
  );
}

export async function listProducts(req, res) {
  res.json(await service.listProducts(req.query));
}

export async function listInventoryProducts(req, res) {
  res.json(
    await service.listProducts(
      req.query,
      {
        management: true,
        includeCost:
          hasRequestPermission(
            req,
            "product:cost:read"
          ),
      }
    )
  );
}

export async function getProduct(req, res) {
  res.json(await service.getProduct(req.params.identifier));
}

export async function updateProduct(req, res) {
  const payload = {
    ...req.body,
  };

  // Publication and inventory are governed independently from catalogue editing.
  delete payload.active;
  delete payload.stockQuantity;

  if (
    !hasRequestPermission(
      req,
      "product:inventory:update"
    )
  ) {
    delete payload.reorderLevel;
  }

  res.json(
    await service.updateProduct(
      req.params.id,
      payload
    )
  );
}

export async function updateProductPublication(req, res) {
  if (
    typeof req.body.active !==
    "boolean"
  ) {
    return res.status(400).json({
      message:
        "active must be true or false.",
    });
  }

  return res.json(
    await service.updateProduct(
      req.params.id,
      {
        active:
          req.body.active,
      }
    )
  );
}

export async function adjustStock(req, res) {
  res.json(await service.adjustStock(req.params.id, req.body, req.user));
}

export async function listStockAdjustments(req, res) {
  res.json(await service.listStockAdjustments(req.params.id, req.query));
}

export async function inventorySummary(req, res) {
  res.json(
    await service.inventorySummary({
      includeCost:
        hasRequestPermission(
          req,
          "product:cost:read"
        ),
    })
  );
}

export async function createCheckout(req, res) {
  res.status(201).json(await service.createCheckout(req.body, req.user));
}

export async function confirmDemoCheckout(req, res) {
  res.json(await service.confirmDemoCheckout(req.params.id, req.user));
}

export async function listMyOrders(req, res) {
  res.json(await service.listMyOrders(req.user, req.query));
}

export async function getOrder(req, res) {
  res.json(await service.getOrder(req.params.id, req.user));
}

export async function cancelOrder(req, res) {
  res.json(await service.cancelOrder(req.params.id, req.user));
}

export async function listOrders(req, res) {
  res.json(await service.listOrders(req.query));
}

export async function updateOrderStatus(req, res) {
  res.json(await service.updateOrderStatus(req.params.id, req.body.status));
}

export async function refundOrderPayment(req, res) {
  res.json(await refundOrder(req.params.id, req.body, req.user));
}

export async function stripeWebhook(req, res) {
  const result = await service.handleStripeWebhook(
    req.body,
    req.headers["stripe-signature"]
  );
  res.json(result);
}
