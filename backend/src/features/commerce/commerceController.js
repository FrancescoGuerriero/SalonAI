import * as service from "./commerceService.js";
import { refundOrder } from "./orderRefundService.js";

export function getCommerceConfig(req, res) {
  res.json(service.commerceConfig());
}

export async function createProduct(req, res) {
  res.status(201).json(await service.createProduct(req.body));
}

export async function listProducts(req, res) {
  res.json(await service.listProducts(req.query));
}

export async function listInventoryProducts(req, res) {
  res.json(await service.listProducts(req.query, { management: true }));
}

export async function getProduct(req, res) {
  res.json(await service.getProduct(req.params.identifier));
}

export async function updateProduct(req, res) {
  res.json(await service.updateProduct(req.params.id, req.body));
}

export async function adjustStock(req, res) {
  res.json(await service.adjustStock(req.params.id, req.body, req.user));
}

export async function listStockAdjustments(req, res) {
  res.json(await service.listStockAdjustments(req.params.id, req.query));
}

export async function inventorySummary(req, res) {
  res.json(await service.inventorySummary());
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
