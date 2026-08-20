import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const scriptPath = fileURLToPath(import.meta.url);

function mutate(relativePath, mutator) {
  const filePath = path.join(root, relativePath);
  const original = fs.readFileSync(filePath, "utf8");
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const normalised = original.replace(/\r\n/g, "\n");
  const next = mutator(normalised);
  if (next === normalised) {
    throw new Error(`No change was produced for ${relativePath}.`);
  }
  fs.writeFileSync(filePath, next.replace(/\n/g, newline), "utf8");
}

function replaceOnce(source, oldText, newText, label) {
  const first = source.indexOf(oldText);
  if (first < 0) {
    throw new Error(`Patch anchor not found: ${label}`);
  }
  if (source.indexOf(oldText, first + oldText.length) >= 0) {
    throw new Error(`Patch anchor was not unique: ${label}`);
  }
  return source.slice(0, first) + newText + source.slice(first + oldText.length);
}

mutate("backend/src/features/commerce/commerceService.js", (source) => {
  source = replaceOnce(
    source,
    `export function commerceConfig() {\n  return {\n    currency: "GBP",\n    deliveryFee: money(Number(process.env.DELIVERY_FEE_GBP || 4.95)),\n    paymentMode: paymentProviderMode(),\n  };\n}`,
    `export function commerceConfig() {\n  const configuredDepositPercentage = Number(\n    process.env.APPOINTMENT_DEPOSIT_PERCENTAGE || 25\n  );\n  const appointmentDepositPercentage = Number.isFinite(configuredDepositPercentage)\n    ? Math.min(100, Math.max(1, configuredDepositPercentage))\n    : 25;\n\n  return {\n    currency: "GBP",\n    deliveryFee: money(Number(process.env.DELIVERY_FEE_GBP || 4.95)),\n    appointmentDepositPercentage,\n    paymentMode: paymentProviderMode(),\n  };\n}`,
    "commerce config appointment deposit percentage"
  );

  source = replaceOnce(
    source,
    `async function commitInventory(order) {\n  if (order.inventoryCommittedAt) {\n    return;\n  }\n\n  const committed = [];\n  const productItems = order.items.filter(\n    (item) => String(item.itemType || "product") === "product"\n  );\n\n  try {\n    for (const item of productItems) {\n      const result = await Product.findOneAndUpdate(\n        {\n          _id: item.product,\n          stockQuantity: { $gte: item.quantity },\n        },\n        { $inc: { stockQuantity: -item.quantity } },\n        { new: true }\n      );\n\n      if (!result) {\n        throw createServiceError(\`${item.name} no longer has enough stock.\`, 409);\n      }\n\n      committed.push(item);\n    }\n  } catch (error) {\n    for (const item of committed) {\n      await Product.findByIdAndUpdate(item.product, {\n        $inc: { stockQuantity: item.quantity },\n      });\n    }\n    throw error;\n  }\n\n  order.inventoryCommittedAt = new Date();\n}\n\nasync function settleAppointmentAllocations(order, providerData = {}) {\n  const appointmentItems = order.items.filter(\n    (item) => String(item.itemType || "") === "appointment"\n  );\n\n  for (const item of appointmentItems) {\n    if (!item.appointment || !item.appointmentPayment) continue;\n\n    await settleAppointmentPayment(item.appointment, {\n      paymentId: item.appointmentPayment,\n      providerPaymentId: providerData.providerPaymentId,\n      providerIntentId: providerData.providerIntentId,\n      rawStatus: providerData.rawStatus || "paid",\n    });\n  }\n}\n\nexport async function settlePaidOrder(orderId, providerData = {}) {\n  const order = assertFound(\n    await Order.findById(orderId).populate("payment"),\n    "Order not found."\n  );\n\n  await settleAppointmentAllocations(order, providerData);\n\n  if (["paid", "processing", "ready", "completed"].includes(order.status)) {\n    return order;\n  }\n\n  await commitInventory(order);\n  const paidAt = new Date();\n  order.status = "paid";\n  order.paidAt = paidAt;\n  await order.save();\n\n  if (order.payment) {\n    await Payment.findByIdAndUpdate(order.payment._id || order.payment, {\n      $set: {\n        status: "paid",\n        paidAt,\n        providerPaymentId:\n          providerData.providerPaymentId || order.payment.providerPaymentId,\n        providerIntentId:\n          providerData.providerIntentId || order.payment.providerIntentId || "",\n        rawStatus: providerData.rawStatus || "paid",\n      },\n    });\n  }\n\n  return order;\n}`,
    `async function commitInventory(order) {\n  if (order.inventoryCommittedAt) {\n    return;\n  }\n\n  const committed = [];\n  const productItems = order.items.filter(\n    (item) => String(item.itemType || "product") === "product"\n  );\n\n  try {\n    for (const item of productItems) {\n      const result = await Product.findOneAndUpdate(\n        {\n          _id: item.product,\n          stockQuantity: { $gte: item.quantity },\n        },\n        { $inc: { stockQuantity: -item.quantity } },\n        { new: true }\n      );\n\n      if (!result) {\n        throw createServiceError(\`${item.name} no longer has enough stock.\`, 409);\n      }\n\n      committed.push(item);\n    }\n\n    // Persist the inventory checkpoint before appointment allocation settlement.\n    // If a later appointment update fails, Stripe/webhook retry can safely resume\n    // without decrementing product stock a second time.\n    order.inventoryCommittedAt = new Date();\n    await order.save();\n  } catch (error) {\n    for (const item of [...committed].reverse()) {\n      await Product.findByIdAndUpdate(item.product, {\n        $inc: { stockQuantity: item.quantity },\n      });\n    }\n    order.inventoryCommittedAt = null;\n    throw error;\n  }\n}\n\nasync function settleAppointmentAllocations(order, providerData = {}) {\n  const appointmentItems = order.items.filter(\n    (item) => String(item.itemType || "") === "appointment"\n  );\n\n  for (const item of appointmentItems) {\n    if (!item.appointment || !item.appointmentPayment) continue;\n\n    await settleAppointmentPayment(item.appointment, {\n      paymentId: item.appointmentPayment,\n      providerPaymentId: providerData.providerPaymentId,\n      providerIntentId: providerData.providerIntentId,\n      rawStatus: providerData.rawStatus || "paid",\n    });\n  }\n}\n\nexport async function settlePaidOrder(orderId, providerData = {}) {\n  const order = assertFound(\n    await Order.findById(orderId).populate("payment"),\n    "Order not found."\n  );\n\n  if (["paid", "processing", "ready", "completed"].includes(order.status)) {\n    return order;\n  }\n\n  // Product availability must be committed before appointment balances are\n  // mutated. Once inventory is checkpointed, an appointment-settlement failure\n  // remains retryable without double-decrementing stock.\n  await commitInventory(order);\n  await settleAppointmentAllocations(order, providerData);\n\n  const paidAt = new Date();\n  order.status = "paid";\n  order.paidAt = paidAt;\n  await order.save();\n\n  if (order.payment) {\n    await Payment.findByIdAndUpdate(order.payment._id || order.payment, {\n      $set: {\n        status: "paid",\n        paidAt,\n        providerPaymentId:\n          providerData.providerPaymentId || order.payment.providerPaymentId,\n        providerIntentId:\n          providerData.providerIntentId || order.payment.providerIntentId || "",\n        rawStatus: providerData.rawStatus || "paid",\n      },\n    });\n  }\n\n  return order;\n}`,
    "inventory-before-appointment settlement"
  );

  return source;
});

mutate("backend/src/features/commerce/orderRefundService.js", (source) => {
  source = replaceOnce(
    source,
    `function money(value) {\n  return Number(Number(value || 0).toFixed(2));\n}`,
    `function money(value) {\n  return Number(Number(value || 0).toFixed(2));\n}\n\nfunction hasAppointmentAllocations(order) {\n  return Array.isArray(order?.items) && order.items.some(\n    (item) => String(item?.itemType || "product") === "appointment"\n  );\n}`,
    "refund appointment-allocation helper"
  );

  source = replaceOnce(
    source,
    `  if (!order.payment) {\n    throw createServiceError("This order has no payment record.", 409);\n  }`,
    `  if (hasAppointmentAllocations(order)) {\n    throw createServiceError(\n      "Orders containing appointment payments require an allocation-aware manager refund workflow. Automatic refunds are disabled for this order.",\n      409\n    );\n  }\n\n  if (!order.payment) {\n    throw createServiceError("This order has no payment record.", 409);\n  }`,
    "block unsafe appointment-order refunds"
  );

  source = replaceOnce(
    source,
    `  if (payment.order) {\n    const order = await Order.findById(payment.order);\n    if (order) {\n      await applyOrderRefundState(order, payment);\n    }\n  }\n\n  return {\n    reconciled: true,\n    paymentId: String(payment._id),\n    orderId: payment.order ? String(payment.order) : null,\n    providerRefundId,\n    status,\n  };`,
    `  let manualReconciliationRequired = false;\n  if (payment.order) {\n    const order = await Order.findById(payment.order);\n    if (order) {\n      if (hasAppointmentAllocations(order)) {\n        manualReconciliationRequired = true;\n        payment.metadata = {\n          ...(payment.metadata || {}),\n          refundReconciliationRequired: true,\n          refundReconciliationReason: "appointment_allocation_present",\n          latestProviderRefundId: providerRefundId,\n        };\n        await payment.save();\n        console.error("[SalonAI mixed refund] Manual reconciliation required", {\n          orderId: String(order._id),\n          paymentId: String(payment._id),\n          providerRefundId,\n          status,\n        });\n      } else {\n        await applyOrderRefundState(order, payment);\n      }\n    }\n  }\n\n  return {\n    reconciled: true,\n    paymentId: String(payment._id),\n    orderId: payment.order ? String(payment.order) : null,\n    providerRefundId,\n    status,\n    manualReconciliationRequired,\n  };`,
    "flag external mixed refunds for manual reconciliation"
  );

  return source;
});

mutate("backend/src/features/appointments/appointmentNotificationService.js", (source) => {
  source = replaceOnce(
    source,
    `export async function notifyAppointmentPaymentFailed(\n  appointmentId,`,
    `export async function notifyAppointmentPaymentReceived(\n  appointmentId,\n  {\n    amount = null,\n    remainingBalance = null,\n    eventKeySuffix = "",\n    actorId = null,\n  } = {}\n) {\n  const appointment = await loadAppointment(appointmentId);\n  if (!appointment) return { success: false, skipped: true, reason: "appointment_not_found" };\n\n  const details = appointmentDetails(appointment);\n  const receivedAmount = money(amount ?? 0);\n  const balance = money(remainingBalance ?? appointment.balanceDue ?? 0);\n  const amountLabel = \`£${receivedAmount.toFixed(2)}\`;\n  const balanceLabel = \`£${balance.toFixed(2)}\`;\n  const balanceSentence = balance <= 0\n    ? "Your appointment balance is now paid in full."\n    : \`Your remaining appointment balance is ${balanceLabel}.\`;\n  const body = \`Hi ${details.name}, we received ${amountLabel} for your ${details.service} appointment on ${details.date} at ${details.time}. ${balanceSentence}\`;\n\n  return sendAppointmentEvent({\n    appointment,\n    event: "appointment.payment_received",\n    eventKey: \`appointment.payment_received:${appointment._id}:${eventKeySuffix || appointment.updatedAt}\`,\n    subject: \`Appointment payment received - ${amountLabel}\`,\n    body,\n    html: \`<p>Hi ${details.name},</p><p>We received <strong>${amountLabel}</strong> for your <strong>${details.service}</strong> appointment on <strong>${details.date} at ${details.time}</strong>.</p><p>${balanceSentence}</p>\`,\n    templateSid: process.env.TWILIO_WHATSAPP_APPOINTMENT_PAYMENT_RECEIVED_CONTENT_SID,\n    templateVariables: {\n      1: details.name,\n      2: amountLabel,\n      3: details.service,\n      4: details.date,\n      5: details.time,\n      6: balanceLabel,\n    },\n    metadata: {\n      receivedAmount,\n      remainingBalance: balance,\n    },\n    actorId,\n  });\n}\n\nexport async function notifyAppointmentPaymentFailed(\n  appointmentId,`,
    "appointment payment received notification"
  );

  source = replaceOnce(
    source,
    `  notifyAppointmentPaymentFailed,\n  notifyAppointmentPaymentRequest,`,
    `  notifyAppointmentPaymentFailed,\n  notifyAppointmentPaymentReceived,\n  notifyAppointmentPaymentRequest,`,
    "notification default export"
  );

  return source;
});

mutate("backend/src/features/appointments/appointmentPaymentService.js", (source) => {
  source = replaceOnce(
    source,
    `  notifyAppointmentPaymentFailed,\n  notifyAppointmentPaymentRequest,\n  notifySafely,`,
    `  notifyAppointmentPaymentFailed,\n  notifyAppointmentPaymentReceived,\n  notifyAppointmentPaymentRequest,\n  notifySafely,`,
    "payment service received-notification import"
  );

  source = replaceOnce(
    source,
    `  await Promise.all([appointment.save(), payment.save()]);\n\n  return {\n    appointment: appointment.toObject(),\n    payment: payment.toObject(),\n  };`,
    `  await Promise.all([appointment.save(), payment.save()]);\n\n  await notifySafely(\n    () => notifyAppointmentPaymentReceived(appointment._id, {\n      amount: paidAmount,\n      remainingBalance: nextBalance,\n      eventKeySuffix: String(payment._id),\n    }),\n    {\n      appointmentId: String(appointment._id),\n      paymentId: String(payment._id),\n    }\n  );\n\n  return {\n    appointment: appointment.toObject(),\n    payment: payment.toObject(),\n  };`,
    "send payment received notification after settlement"
  );

  return source;
});

mutate("frontend/src/context/CartContext.jsx", (source) => {
  source = replaceOnce(
    source,
    `} from "react";\n\nconst STORAGE_KEY = "salonai_cart_v1";`,
    `} from "react";\n\nimport commerceService from "../Services/commerceService.js";\n\nconst STORAGE_KEY = "salonai_cart_v1";`,
    "cart commerce config import"
  );

  source = replaceOnce(
    source,
    `function appointmentDeposit(appointment) {\n  const balance = appointmentBalance(appointment);\n  return Math.min(balance, Math.max(0.01, balance * 0.25));\n}`,
    `function appointmentDeposit(appointment, percentage = 25) {\n  const balance = appointmentBalance(appointment);\n  const configured = Number(percentage);\n  const safePercentage = Number.isFinite(configured)\n    ? Math.min(100, Math.max(1, configured))\n    : 25;\n  return Math.min(\n    balance,\n    Math.max(0.01, balance * (safePercentage / 100))\n  );\n}`,
    "cart configurable appointment deposit"
  );

  source = replaceOnce(
    source,
    `export function CartProvider({ children }) {\n  const [items, setItems] = useState(readCart);\n\n  useEffect(() => {\n    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));\n  }, [items]);`,
    `export function CartProvider({ children }) {\n  const [items, setItems] = useState(readCart);\n  const [appointmentDepositPercentage, setAppointmentDepositPercentage] = useState(25);\n\n  useEffect(() => {\n    let active = true;\n    commerceService\n      .getConfig()\n      .then((config) => {\n        const configured = Number(config?.appointmentDepositPercentage);\n        if (active && Number.isFinite(configured)) {\n          setAppointmentDepositPercentage(Math.min(100, Math.max(1, configured)));\n        }\n      })\n      .catch(() => {});\n\n    return () => {\n      active = false;\n    };\n  }, []);\n\n  useEffect(() => {\n    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));\n  }, [items]);`,
    "cart load deposit percentage from backend"
  );

  source = replaceOnce(
    source,
    `      const price = paymentPurpose === "deposit"\n        ? appointmentDeposit(appointment)\n        : balance;`,
    `      const price = paymentPurpose === "deposit"\n        ? appointmentDeposit(appointment, appointmentDepositPercentage)\n        : balance;`,
    "cart use configured deposit percentage"
  );

  source = replaceOnce(
    source,
    `  }, []);\n\n  const updateQuantity = useCallback((identifier, quantity) => {`,
    `  }, [appointmentDepositPercentage]);\n\n  const updateQuantity = useCallback((identifier, quantity) => {`,
    "cart addAppointment callback dependency"
  );

  return source;
});

const safetyTestPath = path.join(root, "backend/src/test/mixedCartSafety.test.js");
const safetyTest = `import assert from "node:assert/strict";\nimport fs from "node:fs";\nimport path from "node:path";\nimport test from "node:test";\nimport { fileURLToPath } from "node:url";\n\nimport { commerceConfig } from "../features/commerce/commerceService.js";\n\nconst here = path.dirname(fileURLToPath(import.meta.url));\nconst backendRoot = path.resolve(here, "../..");\nconst repoRoot = path.resolve(backendRoot, "..");\n\nfunction source(relativePath) {\n  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");\n}\n\ntest("commerce config exposes the server appointment deposit percentage", () => {\n  const previous = process.env.APPOINTMENT_DEPOSIT_PERCENTAGE;\n  process.env.APPOINTMENT_DEPOSIT_PERCENTAGE = "30";\n  try {\n    assert.equal(commerceConfig().appointmentDepositPercentage, 30);\n  } finally {\n    if (previous === undefined) delete process.env.APPOINTMENT_DEPOSIT_PERCENTAGE;\n    else process.env.APPOINTMENT_DEPOSIT_PERCENTAGE = previous;\n  }\n});\n\ntest("mixed settlement checkpoints inventory before appointment allocation", () => {\n  const text = source("backend/src/features/commerce/commerceService.js");\n  const start = text.indexOf("export async function settlePaidOrder");\n  const inventory = text.indexOf("await commitInventory(order);", start);\n  const appointment = text.indexOf("await settleAppointmentAllocations(order, providerData);", start);\n  assert.ok(start >= 0);\n  assert.ok(inventory > start);\n  assert.ok(appointment > inventory);\n\n  const commitStart = text.indexOf("async function commitInventory(order)");\n  const commitEnd = text.indexOf("async function settleAppointmentAllocations", commitStart);\n  const commitBlock = text.slice(commitStart, commitEnd);\n  assert.match(commitBlock, /order\\.inventoryCommittedAt = new Date\\(\\);/);\n  assert.match(commitBlock, /await order\\.save\\(\\);/);\n});\n\ntest("generic refunds reject orders containing appointment allocations", () => {\n  const text = source("backend/src/features/commerce/orderRefundService.js");\n  assert.match(text, /function hasAppointmentAllocations\\(order\\)/);\n  assert.match(text, /Orders containing appointment payments require an allocation-aware manager refund workflow/);\n  assert.match(text, /refundReconciliationRequired: true/);\n});\n\ntest("appointment settlement emits a payment-received notification", () => {\n  const notifications = source("backend/src/features/appointments/appointmentNotificationService.js");\n  const payments = source("backend/src/features/appointments/appointmentPaymentService.js");\n  assert.match(notifications, /export async function notifyAppointmentPaymentReceived/);\n  assert.match(payments, /notifyAppointmentPaymentReceived\\(appointment\\._id/);\n});\n\ntest("cart obtains the deposit percentage from commerce config", () => {\n  const text = source("frontend/src/context/CartContext.jsx");\n  assert.match(text, /commerceService\\s*\\.getConfig\\(\\)/);\n  assert.match(text, /appointmentDepositPercentage/);\n  assert.match(text, /appointmentDeposit\\(appointment, appointmentDepositPercentage\\)/);\n});\n`;
fs.writeFileSync(safetyTestPath, safetyTest, "utf8");

console.log("V8_10_2_HARDENING_PATCH=PASS");
console.log("CHANGED_FILES=6");
console.log("NEXT=npm test in backend, then frontend build");

try {
  fs.unlinkSync(scriptPath);
  console.log("PATCH_SCRIPT_REMOVED=PASS");
} catch (error) {
  console.warn(`PATCH_SCRIPT_REMOVED=FAIL ${error.message}`);
}
