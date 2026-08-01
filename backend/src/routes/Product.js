import mongoose from "mongoose";

import Product from "./Product.js";
import Order from "./Order.js";
import Payment from "./Payment.js";
import InventoryAdjustment from "./InventoryAdjustment.js";
import {
  constructStripeEvent,
  createCheckoutPayment,
  paymentProviderMode,
} from "../../providers/paymentProvider.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import {
  paginationFromQuery,
  paginationResult,
} from "../../shared/pagination.js";
import { escapedRegex } from "../../shared/modelHelpers.js";

const MANAGEMENT_ROLES = new Set(["admin", "manager", "stylist"]);

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isManagementUser(user) {
  return MANAGEMENT_ROLES.has(String(user?.role || "").toLowerCase());
}

function productFields(management) {
  return management ? "+costPrice" : "-costPrice";
}

async function uniqueSlug(name, currentId = null) {
  const base = slugify(name) || `product-${Date.now()}`;
  let slug = base;
  let suffix = 2;

  while (
    await Product.exists({
      slug,
      ...(currentId ? { _id: { $ne: currentId } } : {}),
    })
  ) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function normaliseProductPayload(payload, { partial = false } = {}) {
  const output = {};
  const stringFields = ["name", "sku", "brand", "description", "category", "size"];
  const numberFields = ["price", "costPrice", "stockQuantity", "reorderLevel"];
  const booleanFields = ["featured", "active"];

  for (const field of stringFields) {
    if (payload[field] !== undefined) {
      output[field] = String(payload[field]).trim();
    }
  }

  for (const field of numberFields) {
    if (payload[field] !== undefined) {
      const value = Number(payload[field]);
      if (!Number.isFinite(value) || value < 0) {
        throw createServiceError(`${field} must be a non-negative number.`, 400);
      }
      output[field] = value;
    }
  }

  for (const field of booleanFields) {
    if (payload[field] !== undefined) {
      output[field] =
        typeof payload[field] === "string"
          ? payload[field].toLowerCase() === "true"
          : Boolean(payload[field]);
    }
  }

  if (payload.images !== undefined) {
    output.images = Array.isArray(payload.images)
      ? payload.images.map((image) => String(image).trim()).filter(Boolean)
      : [];
  }

  if (!partial && (!output.name || !output.sku || output.price === undefined)) {
    throw createServiceError("Product name, SKU and price are required.", 400);
  }

  if (output.sku) {
    output.sku = output.sku.toUpperCase();
  }

  return output;
}

export async function createProduct(payload) {
  const data = normaliseProductPayload(payload);
  data.slug = await uniqueSlug(data.name);
  return Product.create(data);
}

export async function listProducts(query = {}, { management = false } = {}) {
  const { page, limit, skip } = paginationFromQuery(query);
  const match = {};

  if (!management) {
    match.active = true;
  } else if (query.active !== undefined) {
    match.active = String(query.active).toLowerCase() === "true";
  }

  if (query.category) {
    match.category = query.category;
  }

  if (query.featured !== undefined) {
    match.featured = String(query.featured).toLowerCase() === "true";
  }

  if (query.inStock === "true") {
    match.stockQuantity = { $gt: 0 };
  }

  if (query.lowStock === "true") {
    match.$expr = { $lte: ["$stockQuantity", "$reorderLevel"] };
  }

  if (query.search) {
    const expression = escapedRegex(query.search);
    match.$or = [
      { name: expression },
      { sku: expression },
      { brand: expression },
      { description: expression },
      { category: expression },
    ];
  }

  const sortMap = {
    newest: { createdAt: -1 },
    price_asc: { price: 1, name: 1 },
    price_desc: { price: -1, name: 1 },
    name: { name: 1 },
  };

  const [items, total, categories] = await Promise.all([
    Product.find(match)
      .select(productFields(management))
      .sort(sortMap[query.sort] || { featured: -1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    Product.countDocuments(match),
    Product.distinct("category", { active: true }),
  ]);

  return {
    items,
    categories: categories.filter(Boolean).sort(),
    pagination: paginationResult(page, limit, total),
  };
}

export async function getProduct(identifier, { management = false } = {}) {
  const match = mongoose.isValidObjectId(identifier)
    ? { _id: identifier }
    : { slug: String(identifier).toLowerCase() };

  if (!management) {
    match.active = true;
  }

  const query = Product.findOne(match);
  if (!management) {
    query.select("-costPrice");
  }

  return assertFound(await query.lean({ virtuals: true }), "Product not found.");
}

export async function updateProduct(id, payload) {
  const product = assertFound(await Product.findById(id), "Product not found.");
  const data = normaliseProductPayload(payload, { partial: true });
  delete data.stockQuantity;

  if (data.name && data.name !== product.name) {
    data.slug = await uniqueSlug(data.name, product._id);
  }

  Object.assign(product, data);
  await product.save();
  return product.toObject({ virtuals: true });
}

export async function adjustStock(id, payload, user) {
  const delta = Number(payload.delta);
  const reason = String(payload.reason || "").trim();

  if (!Number.isInteger(delta) || delta === 0) {
    throw createServiceError("Stock adjustment delta must be a non-zero integer.", 400);
  }

  if (!reason) {
    throw createServiceError("A stock adjustment reason is required.", 400);
  }

  const product = assertFound(await Product.findById(id), "Product not found.");
  const previousQuantity = product.stockQuantity;
  const newQuantity = previousQuantity + delta;

  if (newQuantity < 0) {
    throw createServiceError("The stock adjustment would make inventory negative.", 409);
  }

  product.stockQuantity = newQuantity;
  await product.save();

  const adjustment = await InventoryAdjustment.create({
    product: product._id,
    delta,
    previousQuantity,
    newQuantity,
    reason,
    reference: String(payload.reference || "").trim(),
    adjustedBy: user._id,
  });

  return { product: product.toObject({ virtuals: true }), adjustment };
}

export async function listStockAdjustments(productId, query = {}) {
  const { page, limit, skip } = paginationFromQuery(query);
  const match = productId ? { product: productId } : {};
  const [items, total] = await Promise.all([
    InventoryAdjustment.find(match)
      .populate("product", "name sku")
      .populate("adjustedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    InventoryAdjustment.countDocuments(match),
  ]);

  return { items, pagination: paginationResult(page, limit, total) };
}

export function commerceConfig() {
  return {
    currency: "GBP",
    deliveryFee: money(Number(process.env.DELIVERY_FEE_GBP || 4.95)),
    paymentMode: paymentProviderMode(),
  };
}

export async function inventorySummary() {
  const [totals, lowStockProducts, lowStockCount] = await Promise.all([
    Product.aggregate([
      { $match: { active: true } },
      {
        $group: {
          _id: null,
          productCount: { $sum: 1 },
          unitsInStock: { $sum: "$stockQuantity" },
          retailValue: { $sum: { $multiply: ["$stockQuantity", "$price"] } },
          costValue: { $sum: { $multiply: ["$stockQuantity", "$costPrice"] } },
        },
      },
    ]),
    Product.find({
      active: true,
      $expr: { $lte: ["$stockQuantity", "$reorderLevel"] },
    })
      .select("name sku stockQuantity reorderLevel price")
      .sort({ stockQuantity: 1 })
      .limit(20)
      .lean(),
    Product.countDocuments({
      active: true,
      $expr: { $lte: ["$stockQuantity", "$reorderLevel"] },
    }),
  ]);

  const summary = totals[0] || {
    productCount: 0,
    unitsInStock: 0,
    retailValue: 0,
    costValue: 0,
  };

  return {
    ...summary,
    retailValue: money(summary.retailValue),
    costValue: money(summary.costValue),
    lowStockCount,
    lowStockProducts,
  };
}

async function buildOrderItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw createServiceError("At least one order item is required.", 400);
  }

  const requested = new Map();
  for (const item of items) {
    const productId = String(item.product || item.productId || "");
    if (!mongoose.isValidObjectId(productId)) {
      throw createServiceError("Every cart item must contain a valid product ID.", 400);
    }
    const quantity = Math.max(1, Math.min(99, Number.parseInt(item.quantity, 10) || 1));
    requested.set(productId, (requested.get(productId) || 0) + quantity);
  }

  const products = await Product.find({
    _id: { $in: [...requested.keys()] },
    active: true,
  });
  const productsById = new Map(products.map((product) => [String(product._id), product]));

  return [...requested.entries()].map(([productId, quantity]) => {
    const product = productsById.get(productId);
    assertFound(product, `Product ${productId} was not found.`);

    if (product.stockQuantity < quantity) {
      throw createServiceError(
        `${product.name} has only ${product.stockQuantity} item(s) available.`,
        409
      );
    }

    return {
      product: product._id,
      sku: product.sku,
      name: product.name,
      image: product.images?.[0] || "",
      quantity,
      unitPrice: money(product.price),
      lineTotal: money(product.price * quantity),
    };
  });
}

function checkoutUrls(order) {
  const frontendUrl = String(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  return {
    successUrl: `${frontendUrl}/checkout/success?order=${order._id}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${frontendUrl}/cart?checkout=cancelled`,
  };
}

export async function createCheckout(payload, user) {
  const items = await buildOrderItems(payload.items);
  const subtotal = money(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const fulfilmentType = payload.fulfilmentType === "delivery" ? "delivery" : "collection";
  const deliveryFee = fulfilmentType === "delivery"
    ? money(Number(process.env.DELIVERY_FEE_GBP || 4.95))
    : 0;
  const total = money(subtotal + deliveryFee);

  const contact = {
    name: String(payload.contact?.name || user.name || "").trim(),
    email: String(payload.contact?.email || user.email || "").trim().toLowerCase(),
    phone: String(payload.contact?.phone || "").trim(),
  };

  if (!contact.name || !contact.email) {
    throw createServiceError("Checkout name and email are required.", 400);
  }

  if (fulfilmentType === "delivery") {
    const address = payload.deliveryAddress || {};
    if (!address.line1 || !address.city || !address.postcode) {
      throw createServiceError("Address line, city and postcode are required for delivery.", 400);
    }
  }

  const order = await Order.create({
    user: user._id,
    customer: user.customerProfile || undefined,
    contact,
    items,
    subtotal,
    deliveryFee,
    discountTotal: 0,
    total,
    currency: "GBP",
    status: "pending_payment",
    fulfilmentType,
    deliveryAddress: fulfilmentType === "delivery" ? payload.deliveryAddress : undefined,
    notes: String(payload.notes || "").trim(),
  });

  try {
    const urls = checkoutUrls(order);
    const providerResult = await createCheckoutPayment({
      order,
      items: deliveryFee
        ? [
            ...items,
            {
              name: "UK delivery",
              sku: "DELIVERY",
              quantity: 1,
              unitPrice: deliveryFee,
              image: "",
            },
          ]
        : items,
      customerEmail: contact.email,
      ...urls,
    });

    const payment = await Payment.create({
      user: user._id,
      customer: user.customerProfile || undefined,
      order: order._id,
      purpose: "product_order",
      amount: total,
      currency: "GBP",
      provider: providerResult.provider,
      providerPaymentId: providerResult.providerPaymentId,
      providerIntentId: providerResult.providerIntentId || "",
      checkoutUrl: providerResult.checkoutUrl || "",
      status: providerResult.status || "pending",
      rawStatus: providerResult.rawStatus || "",
      metadata: { orderNumber: order.orderNumber },
    });

    order.payment = payment._id;
    await order.save();

    if (providerResult.status === "paid") {
      await settlePaidOrder(order._id, {
        providerPaymentId: providerResult.providerPaymentId,
        providerIntentId: providerResult.providerIntentId,
      });
    }

    return {
      order: order.toObject(),
      payment: {
        id: payment._id,
        provider: payment.provider,
        status: payment.status,
        checkoutUrl: payment.checkoutUrl,
      },
      requiresDemoConfirmation: payment.provider === "console",
    };
  } catch (error) {
    order.status = "cancelled";
    order.cancelledAt = new Date();
    await order.save();
    throw error;
  }
}

async function commitInventory(order) {
  if (order.inventoryCommittedAt) {
    return;
  }

  const committed = [];

  try {
    for (const item of order.items) {
      const result = await Product.findOneAndUpdate(
        {
          _id: item.product,
          stockQuantity: { $gte: item.quantity },
        },
        { $inc: { stockQuantity: -item.quantity } },
        { new: true }
      );

      if (!result) {
        throw createServiceError(`${item.name} no longer has enough stock.`, 409);
      }

      committed.push(item);
    }
  } catch (error) {
    for (const item of committed) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stockQuantity: item.quantity },
      });
    }
    throw error;
  }

  order.inventoryCommittedAt = new Date();
}

export async function settlePaidOrder(orderId, providerData = {}) {
  const order = assertFound(
    await Order.findById(orderId).populate("payment"),
    "Order not found."
  );

  if (order.status === "paid" || order.status === "processing" || order.status === "ready" || order.status === "completed") {
    return order;
  }

  await commitInventory(order);
  const paidAt = new Date();
  order.status = "paid";
  order.paidAt = paidAt;
  await order.save();

  if (order.payment) {
    await Payment.findByIdAndUpdate(order.payment._id || order.payment, {
      $set: {
        status: "paid",
        paidAt,
        providerPaymentId:
          providerData.providerPaymentId || order.payment.providerPaymentId,
        providerIntentId:
          providerData.providerIntentId || order.payment.providerIntentId || "",
        rawStatus: providerData.rawStatus || "paid",
      },
    });
  }

  return order;
}

export async function confirmDemoCheckout(orderId, user) {
  if (paymentProviderMode() !== "console" || process.env.NODE_ENV === "production") {
    throw createServiceError("Demo checkout confirmation is not available.", 403);
  }

  const order = await findOwnedOrder(orderId, user);
  await settlePaidOrder(order._id, { rawStatus: "demo_paid" });
  return getOrder(order._id, user);
}

function orderAccessMatch(id, user) {
  const match = { _id: id };
  if (!isManagementUser(user)) {
    match.user = user._id;
  }
  return match;
}

async function findOwnedOrder(id, user) {
  if (!mongoose.isValidObjectId(id)) {
    throw createServiceError("Invalid order ID.", 400);
  }
  return assertFound(await Order.findOne(orderAccessMatch(id, user)), "Order not found.");
}

export async function getOrder(id, user) {
  return assertFound(
    await Order.findOne(orderAccessMatch(id, user))
      .populate("payment", "provider status paidAt checkoutUrl")
      .lean(),
    "Order not found."
  );
}

export async function listMyOrders(user, query = {}) {
  return listOrders({ ...query, user: String(user._id) });
}

export async function listOrders(query = {}) {
  const { page, limit, skip } = paginationFromQuery(query);
  const match = {};
  if (query.status) match.status = query.status;
  if (query.customer) match.customer = query.customer;
  if (query.user) match.user = query.user;

  const [items, total] = await Promise.all([
    Order.find(match)
      .populate("user", "name email")
      .populate("customer", "firstName lastName fullName name email")
      .populate("payment", "provider status paidAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(match),
  ]);

  return { items, pagination: paginationResult(page, limit, total) };
}

export async function cancelOrder(id, user) {
  const order = await findOwnedOrder(id, user);
  if (!["pending_payment", "paid"].includes(order.status)) {
    throw createServiceError("This order can no longer be cancelled online.", 409);
  }
  if (order.status === "paid") {
    throw createServiceError("Paid orders require a manager-issued refund.", 409);
  }
  order.status = "cancelled";
  order.cancelledAt = new Date();
  await order.save();
  await Payment.findByIdAndUpdate(order.payment, { $set: { status: "cancelled" } });
  return order.toObject();
}

export async function updateOrderStatus(id, status) {
  const allowed = ["paid", "processing", "ready", "completed", "cancelled", "refunded"];
  if (!allowed.includes(status)) {
    throw createServiceError("Invalid order status.", 400);
  }

  if (status === "paid") {
    return (await settlePaidOrder(id)).toObject();
  }

  const update = { status };
  if (status === "completed") update.completedAt = new Date();
  if (status === "cancelled") update.cancelledAt = new Date();

  return assertFound(
    await Order.findByIdAndUpdate(id, { $set: update }, { new: true }).lean(),
    "Order not found."
  );
}

export async function handleStripeWebhook(rawBody, signature) {
  const event = constructStripeEvent(rawBody, signature);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    if (orderId) {
      await settlePaidOrder(orderId, {
        providerPaymentId: session.id,
        providerIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || "",
        rawStatus: session.payment_status || session.status || "paid",
      });
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    const payment = await Payment.findOne({ providerPaymentId: session.id });
    if (payment && payment.status === "pending") {
      payment.status = "cancelled";
      payment.rawStatus = session.status || "expired";
      await payment.save();
      await Order.findByIdAndUpdate(payment.order, {
        $set: { status: "cancelled", cancelledAt: new Date() },
      });
    }
  }

  return { received: true, type: event.type };
}
