import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const scriptPath = fileURLToPath(import.meta.url);

function read(relativePath) {
  const filePath = path.join(root, relativePath);
  const original = fs.readFileSync(filePath, "utf8");
  return {
    filePath,
    newline: original.includes("\r\n") ? "\r\n" : "\n",
    source: original.replace(/\r\n/g, "\n"),
  };
}

function write(filePath, newline, source) {
  fs.writeFileSync(filePath, source.replace(/\n/g, newline), "utf8");
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

function mutate(relativePath, mutator) {
  const { filePath, newline, source } = read(relativePath);
  const next = mutator(source);
  if (next === source) {
    throw new Error(`No change was produced for ${relativePath}.`);
  }
  write(filePath, newline, next);
}

function replaceWithin(source, startAnchor, endAnchor, mutator, label) {
  const start = source.indexOf(startAnchor);
  if (start < 0) throw new Error(`Patch block start not found: ${label}`);
  const end = source.indexOf(endAnchor, start + startAnchor.length);
  if (end < 0) throw new Error(`Patch block end not found: ${label}`);
  const block = source.slice(start, end);
  const nextBlock = mutator(block);
  if (nextBlock === block) throw new Error(`No change was produced in block: ${label}`);
  return source.slice(0, start) + nextBlock + source.slice(end);
}

mutate("backend/src/features/commerce/commerceService.js", (source) => {
  source = replaceOnce(
    source,
    `export function commerceConfig() {\n  return {\n    currency: "GBP",\n    deliveryFee: money(Number(process.env.DELIVERY_FEE_GBP || 4.95)),\n    paymentMode: paymentProviderMode(),\n  };\n}`,
    `export function commerceConfig() {\n  const configuredDepositPercentage = Number(\n    process.env.APPOINTMENT_DEPOSIT_PERCENTAGE || 25\n  );\n  const appointmentDepositPercentage = Number.isFinite(configuredDepositPercentage)\n    ? Math.min(100, Math.max(1, configuredDepositPercentage))\n    : 25;\n\n  return {\n    currency: "GBP",\n    deliveryFee: money(Number(process.env.DELIVERY_FEE_GBP || 4.95)),\n    appointmentDepositPercentage,\n    paymentMode: paymentProviderMode(),\n  };\n}`,
    "commerce config appointment deposit percentage"
  );

  source = replaceWithin(
    source,
    "async function commitInventory(order) {",
    "async function settleAppointmentAllocations(order, providerData = {}) {",
    (block) => {
      block = replaceOnce(
        block,
        `    }\n  } catch (error) {`,
        `    }\n\n    // Persist the inventory checkpoint before appointment allocation settlement.\n    // A later webhook retry can then resume without decrementing stock twice.\n    order.inventoryCommittedAt = new Date();\n    await order.save();\n  } catch (error) {`,
        "persist inventory checkpoint"
      );
      block = replaceOnce(
        block,
        `    for (const item of committed) {`,
        `    for (const item of [...committed].reverse()) {`,
        "reverse inventory rollback"
      );
      block = replaceOnce(
        block,
        `    throw error;\n  }\n\n  order.inventoryCommittedAt = new Date();\n}\n\n`,
        `    order.inventoryCommittedAt = null;\n    throw error;\n  }\n}\n\n`,
        "remove late inventory checkpoint"
      );
      return block;
    },
    "inventory commit"
  );

  source = replaceWithin(
    source,
    "export async function settlePaidOrder(orderId, providerData = {}) {",
    "export async function cancelPendingOrderCheckout(",
    (block) => replaceOnce(
      block,
      `\n  await settleAppointmentAllocations(order, providerData);\n\n  if (["paid", "processing", "ready", "completed"].includes(order.status)) {\n    return order;\n  }\n\n  await commitInventory(order);\n`,
      `\n  if (["paid", "processing", "ready", "completed"].includes(order.status)) {\n    return order;\n  }\n\n  // Commit and checkpoint product stock before mutating appointment balances.\n  // If appointment settlement fails, the next webhook retry resumes safely.\n  await commitInventory(order);\n  await settleAppointmentAllocations(order, providerData);\n`,
      "inventory before appointment settlement"
    ),
    "paid order settlement"
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
  const receivedNotification = [
    "export async function notifyAppointmentPaymentReceived(",
    "  appointmentId,",
    "  {",
    "    amount = null,",
    "    remainingBalance = null,",
    "    eventKeySuffix = \"\",",
    "    actorId = null,",
    "  } = {}",
    ") {",
    "  const appointment = await loadAppointment(appointmentId);",
    "  if (!appointment) return { success: false, skipped: true, reason: \"appointment_not_found\" };",
    "",
    "  const details = appointmentDetails(appointment);",
    "  const receivedAmount = money(amount ?? 0);",
    "  const balance = money(remainingBalance ?? appointment.balanceDue ?? 0);",
    "  const amountLabel = \"£\" + receivedAmount.toFixed(2);",
    "  const balanceLabel = \"£\" + balance.toFixed(2);",
    "  const balanceSentence = balance <= 0",
    "    ? \"Your appointment balance is now paid in full.\"",
    "    : \"Your remaining appointment balance is \" + balanceLabel + \".\";",
    "  const body =",
    "    \"Hi \" + details.name + \" we received \" + amountLabel +",
    "    \" for your \" + details.service + \" appointment on \" + details.date +",
    "    \" at \" + details.time + \". \" + balanceSentence;",
    "",
    "  return sendAppointmentEvent({",
    "    appointment,",
    "    event: \"appointment.payment_received\",",
    "    eventKey:",
    "      \"appointment.payment_received:\" + appointment._id + \"\:\" +",
    "      (eventKeySuffix || appointment.updatedAt),",
    "    subject: \"Appointment payment received - \" + amountLabel,",
    "    body,",
    "    html:",
    "      \"<p>Hi \" + details.name + \"</p><p>We received <strong>\" + amountLabel +",
    "      \"</strong> for your <strong>\" + details.service +",
    "      \"</strong> appointment on <strong>\" + details.date + \" at \" + details.time +",
    "      \"</strong>.</p><p>\" + balanceSentence + \"</p>\",",
    "    templateSid: process.env.TWILIO_WHATSAPP_APPOINTMENT_PAYMENT_RECEIVED_CONTENT_SID,",
    "    templateVariables: {",
    "      1: details.name,",
    "      2: amountLabel,",
    "      3: details.service,",
    "      4: details.date,",
    "      5: details.time,",
    "      6: balanceLabel,",
    "    },",
    "    metadata: { receivedAmount, remainingBalance: balance },",
    "    actorId,",
    "  });",
    "}",
    "",
  ].join("\n");

  source = replaceOnce(
    source,
    `export async function notifyAppointmentPaymentFailed(\n  appointmentId,`,
    receivedNotification + `export async function notifyAppointmentPaymentFailed(\n  appointmentId,`,
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
const safetyTest = [
  `import assert from "node:assert/strict";`,
  `import fs from "node:fs";`,
  `import path from "node:path";`,
  `import test from "node:test";`,
  `import { fileURLToPath } from "node:url";`,
  ``,
  `import { commerceConfig } from "../features/commerce/commerceService.js";`,
  ``,
  `const here = path.dirname(fileURLToPath(import.meta.url));`,
  `const backendRoot = path.resolve(here, "../..");`,
  `const repoRoot = path.resolve(backendRoot, "..");`,
  ``,
  `function source(relativePath) {`,
  `  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");`,
  `}`,
  ``,
  `test("commerce config exposes the server appointment deposit percentage", () => {`,
  `  const previous = process.env.APPOINTMENT_DEPOSIT_PERCENTAGE;`,
  `  process.env.APPOINTMENT_DEPOSIT_PERCENTAGE = "30";`,
  `  try {`,
  `    assert.equal(commerceConfig().appointmentDepositPercentage, 30);`,
  `  } finally {`,
  `    if (previous === undefined) delete process.env.APPOINTMENT_DEPOSIT_PERCENTAGE;`,
  `    else process.env.APPOINTMENT_DEPOSIT_PERCENTAGE = previous;`,
  `  }`,
  `});`,
  ``,
  `test("mixed settlement checkpoints inventory before appointment allocation", () => {`,
  `  const text = source("backend/src/features/commerce/commerceService.js");`,
  `  const start = text.indexOf("export async function settlePaidOrder");`,
  `  const inventory = text.indexOf("await commitInventory(order);", start);`,
  `  const appointment = text.indexOf("await settleAppointmentAllocations(order, providerData);", start);`,
  `  assert.ok(start >= 0);`,
  `  assert.ok(inventory > start);`,
  `  assert.ok(appointment > inventory);`,
  `  const commitStart = text.indexOf("async function commitInventory(order)");`,
  `  const commitEnd = text.indexOf("async function settleAppointmentAllocations", commitStart);`,
  `  const commitBlock = text.slice(commitStart, commitEnd);`,
  `  assert.match(commitBlock, /order\\.inventoryCommittedAt = new Date\\(\\);/);`,
  `  assert.match(commitBlock, /await order\\.save\\(\\);/);`,
  `});`,
  ``,
  `test("generic refunds reject orders containing appointment allocations", () => {`,
  `  const text = source("backend/src/features/commerce/orderRefundService.js");`,
  `  assert.match(text, /function hasAppointmentAllocations\\(order\\)/);`,
  `  assert.match(text, /Orders containing appointment payments require an allocation-aware manager refund workflow/);`,
  `  assert.match(text, /refundReconciliationRequired: true/);`,
  `});`,
  ``,
  `test("appointment settlement emits a payment-received notification", () => {`,
  `  const notifications = source("backend/src/features/appointments/appointmentNotificationService.js");`,
  `  const payments = source("backend/src/features/appointments/appointmentPaymentService.js");`,
  `  assert.match(notifications, /export async function notifyAppointmentPaymentReceived/);`,
  `  assert.match(payments, /notifyAppointmentPaymentReceived\\(appointment\\._id/);`,
  `});`,
  ``,
  `test("cart obtains the deposit percentage from commerce config", () => {`,
  `  const text = source("frontend/src/context/CartContext.jsx");`,
  `  assert.match(text, /commerceService\\s*\\.getConfig\\(\\)/);`,
  `  assert.match(text, /appointmentDepositPercentage/);`,
  `  assert.match(text, /appointmentDeposit\\(appointment, appointmentDepositPercentage\\)/);`,
  `});`,
  ``,
].join("\n");
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
