import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
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
import CustomerExperienceProfile from "../customerExperience/CustomerExperienceProfile.js";
import SalonOffer from "../customerExperience/SalonOffer.js";
import {
  prepareAppointmentPaymentReservation,
  releaseAppointmentPaymentReservation,
  settleAppointmentPayment,
} from "../appointments/appointmentPaymentService.js";

const MANAGEMENT_ROLES = new Set(["admin", "manager", "stylist"]);

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function calculateOfferDiscount(offer, subtotal) {
  const safeSubtotal = money(Math.max(0, Number(subtotal) || 0));
  if (!offer || safeSubtotal <= 0) return 0;
  const raw = offer.discountType === "percentage"
    ? safeSubtotal * (Number(offer.value) / 100)
    : Number(offer.value);
  return money(Math.min(safeSubtotal, Math.max(0, raw || 0)));
}

async function claimedOfferForCheckout(codeValue, user, subtotal) {
  const code = String(codeValue || "").trim().toUpperCase();
  if (!code) return null;
  const now = new Date();
  const offer = await SalonOffer.findOne({
    code,
    active: true,
    startsAt: { $lte: now },
    endsAt: { $gt: now },
  });
  if (!offer || (offer.maxClaims && offer.claimCount >= offer.maxClaims)) {
    throw createServiceError("This offer is invalid, unavailable or expired.", 409);
  }
  const claimed = await CustomerExperienceProfile.exists({
    user: user._id,
    claimedOffers: { $elemMatch: { offer: offer._id, code } },
  });
  if (!claimed) {
    throw createServiceError("Save this offer to your customer account before checkout.", 409);
  }
  if (Number(subtotal) < Number(offer.minimumSpend || 0)) {
    throw createServiceError(`This offer requires a minimum spend of £${Number(offer.minimumSpend).toFixed(2)}.`, 409);
  }
  return offer;
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
  const stringFields = ["name", "sku", "brand", "description", "category", "collectionName", "badge", "size"];
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

  if (query.brand) {
    match.brand = query.brand;
  }

  if (query.collection) {
    match.collectionName = query.collection;
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
      { collectionName: expression },
      { badge: expression },
    ];
  }

  const sortMap = {
    newest: { createdAt: -1 },
    price_asc: { price: 1, name: 1 },
    price_desc: { price: -1, name: 1 },
    name: { name: 1 },
  };

  const [items, total, categories, brands, collections] = await Promise.all([
    Product.find(match)
      .select(productFields(management))
      .sort(sortMap[query.sort] || { featured: -1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    Product.countDocuments(match),
    Product.distinct("category", { active: true }),
    Product.distinct("brand", { active: true }),
    Product.distinct("collectionName", { active: true }),
  ]);

  return {
    items,
    categories: categories.filter(Boolean).sort(),
    brands: brands.filter(Boolean).sort(),
    collections: collections.filter(Boolean).sort(),
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

function cartItemType(item = {}) {
  return String(item.type || item.itemType || (item.appointment || item.appointmentId ? "appointment" : "product"))
    .trim()
    .toLowerCase();
}

async function buildProductOrderItems(items = []) {
  const requested = new Map();

  for (const item of items) {
    const productId = String(item.product || item.productId || "");
    if (!mongoose.isValidObjectId(productId)) {
      throw createServiceError("Every product cart item must contain a valid product ID.", 400);
    }
    const quantity = Math.max(1, Math.min(99, Number.parseInt(item.quantity, 10) || 1));
    requested.set(productId, (requested.get(productId) || 0) + quantity);
  }

  if (requested.size === 0) return [];

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
      itemType: "product",
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

async function assertAppointmentCheckoutAccess(appointmentId, user) {
  if (!mongoose.isValidObjectId(appointmentId)) {
    throw createServiceError("Every appointment cart item must contain a valid appointment ID.", 400);
  }

  const appointment = assertFound(
    await Appointment.findById(appointmentId).select("customer status"),
    "Appointment not found."
  );

  if (!isManagementUser(user)) {
    const customerId = String(user?.customerProfile?._id || user?.customerProfile || "");
    if (!customerId || String(appointment.customer) !== customerId) {
      throw createServiceError("You cannot pay for an appointment that is not linked to your account.", 403);
    }
  }

  return appointment;
}

async function buildAppointmentOrderItems(items = [], user) {
  const orderItems = [];
  const reservations = [];
  const seenAppointments = new Set();

  for (const item of items) {
    const appointmentId = String(item.appointment || item.appointmentId || "");
    await assertAppointmentCheckoutAccess(appointmentId, user);

    if (seenAppointments.has(appointmentId)) {
      throw createServiceError("An appointment can appear only once in a checkout.", 409);
    }
    seenAppointments.add(appointmentId);

    const purpose = String(item.purpose || item.paymentPurpose || "balance").toLowerCase() === "deposit"
      ? "deposit"
      : "balance";

    const prepared = await prepareAppointmentPaymentReservation(
      appointmentId,
      { purpose },
      user
    );

    if (prepared.reused) {
      throw createServiceError(
        "A secure checkout is already active for this appointment. Complete or cancel that checkout before starting another.",
        409
      );
    }

    const serviceName = String(
      prepared.appointment.service?.name ||
        prepared.appointment.serviceName ||
        "Salon appointment"
    ).trim();

    const payment = prepared.payment;
    reservations.push(payment);

    orderItems.push({
      itemType: "appointment",
      appointment: prepared.appointment._id,
      appointmentPayment: payment._id,
      paymentPurpose: prepared.purpose,
      sku: `APPOINTMENT-${String(prepared.appointment._id).slice(-8).toUpperCase()}`,
      name: prepared.purpose === "appointment_deposit"
        ? `${serviceName} deposit`
        : `${serviceName} balance`,
      image: "",
      quantity: 1,
      unitPrice: money(payment.amount),
      lineTotal: money(payment.amount),
    });
  }

  return { orderItems, reservations };
}

async function releaseReservations(reservations = [], options = {}) {
  await Promise.all(
    reservations.map((payment) =>
      releaseAppointmentPaymentReservation(payment?._id || payment, options)
    )
  );
}

function checkoutUrls(order) {
  const frontendUrl = String(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  return {
    successUrl: `${frontendUrl}/checkout/success?order=${order._id}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${frontendUrl}/cart?checkout=cancelled`,
  };
}

function providerCheckoutItems({
  productItems,
  appointmentItems,
  productSubtotal,
  discountTotal,
  deliveryFee,
  order,
  offer,
}) {
  const providerItems = [];
  const discountedProductTotal = money(Math.max(0, productSubtotal - discountTotal));

  if (discountTotal > 0) {
    if (discountedProductTotal > 0) {
      providerItems.push({
        name: `SalonAI products ${order.orderNumber}`,
        sku: offer?.code ? `Offer ${offer.code}` : "SalonAI products",
        quantity: 1,
        unitPrice: discountedProductTotal,
        image: "",
      });
    }
  } else {
    providerItems.push(
      ...productItems
        .filter((item) => Number(item.unitPrice) > 0)
        .map((item) => ({
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          image: item.image,
        }))
    );
  }

  providerItems.push(
    ...appointmentItems.map((item) => ({
      name: item.name,
      sku: item.sku,
      quantity: 1,
      unitPrice: item.unitPrice,
      image: "",
    }))
  );

  if (deliveryFee > 0) {
    providerItems.push({
      name: "UK delivery",
      sku: "DELIVERY",
      quantity: 1,
      unitPrice: deliveryFee,
      image: "",
    });
  }

  return providerItems;
}

export async function createCheckout(payload, user) {
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  if (rawItems.length === 0) {
    throw createServiceError("At least one cart item is required.", 400);
  }

  const productRequests = rawItems.filter((item) => cartItemType(item) === "product");
  const appointmentRequests = rawItems.filter((item) => cartItemType(item) === "appointment");

  if (productRequests.length + appointmentRequests.length !== rawItems.length) {
    throw createServiceError("Cart items must be products or appointment payments.", 400);
  }

  const productItems = await buildProductOrderItems(productRequests);
  let appointmentItems = [];
  let reservations = [];
  let order = null;
  let parentPayment = null;

  try {
    const appointmentBuild = await buildAppointmentOrderItems(appointmentRequests, user);
    appointmentItems = appointmentBuild.orderItems;
    reservations = appointmentBuild.reservations;

    const items = [...appointmentItems, ...productItems];
    if (items.length === 0) {
      throw createServiceError("At least one valid checkout item is required.", 400);
    }

    const productSubtotal = money(productItems.reduce((sum, item) => sum + item.lineTotal, 0));
    const appointmentSubtotal = money(appointmentItems.reduce((sum, item) => sum + item.lineTotal, 0));

    if (payload.offerCode && productItems.length === 0) {
      throw createServiceError("Saved offers apply to retail products, not appointment payments.", 409);
    }

    const offer = await claimedOfferForCheckout(payload.offerCode, user, productSubtotal);
    const discountTotal = calculateOfferDiscount(offer, productSubtotal);
    const hasProducts = productItems.length > 0;
    const fulfilmentType = hasProducts && payload.fulfilmentType === "delivery"
      ? "delivery"
      : "collection";
    const deliveryFee = fulfilmentType === "delivery"
      ? money(Number(process.env.DELIVERY_FEE_GBP || 4.95))
      : 0;
    const total = money(productSubtotal - discountTotal + appointmentSubtotal + deliveryFee);

    if (total <= 0) {
      throw createServiceError("Checkout total must be greater than zero.", 409);
    }

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

    order = await Order.create({
      user: user._id,
      customer: user.customerProfile || undefined,
      contact,
      items,
      subtotal: productSubtotal,
      appointmentSubtotal,
      deliveryFee,
      discountTotal,
      offer: offer?._id || null,
      offerCode: offer?.code || "",
      discountDescription: offer?.title || "",
      total,
      currency: "GBP",
      status: "pending_payment",
      fulfilmentType,
      deliveryAddress: fulfilmentType === "delivery" ? payload.deliveryAddress : undefined,
      notes: String(payload.notes || "").trim(),
    });

    for (const payment of reservations) {
      payment.user = user._id;
      payment.order = order._id;
      payment.metadata = {
        ...(payment.metadata || {}),
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        mixedCheckout: true,
      };
      await payment.save();
    }

    parentPayment = await Payment.create({
      user: user._id,
      customer: user.customerProfile || undefined,
      order: order._id,
      purpose: appointmentItems.length > 0 ? "mixed_order" : "product_order",
      amount: total,
      currency: "GBP",
      provider: paymentProviderMode(),
      status: "pending",
      metadata: {
        orderNumber: order.orderNumber,
        productItemCount: productItems.length,
        appointmentItemCount: appointmentItems.length,
      },
    });

    order.payment = parentPayment._id;
    await order.save();

    const urls = checkoutUrls(order);
    const providerResult = await createCheckoutPayment({
      order,
      items: providerCheckoutItems({
        productItems,
        appointmentItems,
        productSubtotal,
        discountTotal,
        deliveryFee,
        order,
        offer,
      }),
      customerEmail: contact.email,
      ...urls,
      idempotencyKey: `salonai:order-checkout:${order._id}`,
    });

    parentPayment.provider = providerResult.provider;
    parentPayment.providerPaymentId = providerResult.providerPaymentId;
    parentPayment.providerIntentId = providerResult.providerIntentId || "";
    parentPayment.checkoutUrl = providerResult.checkoutUrl || "";
    parentPayment.status = providerResult.status || "pending";
    parentPayment.rawStatus = providerResult.rawStatus || "";
    await parentPayment.save();

    for (const payment of reservations) {
      payment.provider = providerResult.provider;
      payment.checkoutUrl = providerResult.checkoutUrl || "";
      payment.rawStatus = providerResult.rawStatus || "";
      payment.metadata = {
        ...(payment.metadata || {}),
        parentPaymentId: String(parentPayment._id),
      };
      await payment.save();
    }

    if (providerResult.status === "paid") {
      await settlePaidOrder(order._id, {
        providerPaymentId: providerResult.providerPaymentId,
        providerIntentId: providerResult.providerIntentId,
        rawStatus: providerResult.rawStatus,
      });
    }

    return {
      order: order.toObject(),
      payment: {
        id: parentPayment._id,
        provider: parentPayment.provider,
        status: parentPayment.status,
        checkoutUrl: parentPayment.checkoutUrl,
      },
      requiresDemoConfirmation: parentPayment.provider === "console",
    };
  } catch (error) {
    if (parentPayment && parentPayment.status !== "paid") {
      parentPayment.status = "failed";
      parentPayment.rawStatus = "checkout_creation_failed";
      parentPayment.failureReason = String(error?.message || "Checkout creation failed.");
      await parentPayment.save().catch(() => {});
    }

    if (order && !["paid", "processing", "ready", "completed"].includes(order.status)) {
      order.status = "cancelled";
      order.cancelledAt = new Date();
      await order.save().catch(() => {});
    }

    await releaseReservations(reservations, {
      status: "cancelled",
      rawStatus: "checkout_creation_failed",
      failureReason: String(error?.message || "Checkout creation failed."),
    }).catch(() => {});

    throw error;
  }
}

async function commitInventory(order) {
  if (order.inventoryCommittedAt) {
    return;
  }

  const committed = [];
  const productItems = order.items.filter(
    (item) => String(item.itemType || "product") === "product"
  );

  try {
    for (const item of productItems) {
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

async function settleAppointmentAllocations(order, providerData = {}) {
  const appointmentItems = order.items.filter(
    (item) => String(item.itemType || "") === "appointment"
  );

  for (const item of appointmentItems) {
    if (!item.appointment || !item.appointmentPayment) continue;

    await settleAppointmentPayment(item.appointment, {
      paymentId: item.appointmentPayment,
      providerPaymentId: providerData.providerPaymentId,
      providerIntentId: providerData.providerIntentId,
      rawStatus: providerData.rawStatus || "paid",
    });
  }
}

export async function settlePaidOrder(orderId, providerData = {}) {
  const order = assertFound(
    await Order.findById(orderId).populate("payment"),
    "Order not found."
  );

  await settleAppointmentAllocations(order, providerData);

  if (["paid", "processing", "ready", "completed"].includes(order.status)) {
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

export async function cancelPendingOrderCheckout(
  orderId,
  {
    paymentStatus = "cancelled",
    rawStatus = "cancelled",
    failureReason = "",
  } = {}
) {
  if (!mongoose.isValidObjectId(orderId)) return null;

  const order = await Order.findById(orderId).populate("payment");
  if (!order || ["paid", "processing", "ready", "completed", "refunded"].includes(order.status)) {
    return order;
  }

  order.status = "cancelled";
  order.cancelledAt = new Date();
  await order.save();

  if (order.payment && !["paid", "refunded", "partially_refunded"].includes(order.payment.status)) {
    order.payment.status = paymentStatus;
    order.payment.rawStatus = rawStatus;
    order.payment.failureReason = String(failureReason || "");
    await order.payment.save();
  }

  const appointmentPaymentIds = order.items
    .filter((item) => String(item.itemType || "") === "appointment" && item.appointmentPayment)
    .map((item) => item.appointmentPayment);

  await releaseReservations(appointmentPaymentIds, {
    status: paymentStatus,
    rawStatus,
    failureReason,
  });

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

  await cancelPendingOrderCheckout(order._id, {
    paymentStatus: "cancelled",
    rawStatus: "customer_cancelled",
    failureReason: "Customer cancelled the checkout.",
  });

  return (await Order.findById(order._id)).toObject();
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
    const orderId = session.metadata?.orderId;
    if (orderId) {
      await cancelPendingOrderCheckout(orderId, {
        paymentStatus: "cancelled",
        rawStatus: session.status || "expired",
        failureReason: "Stripe Checkout session expired before payment completed.",
      });
    }
  }

  return { received: true, type: event.type };
}
