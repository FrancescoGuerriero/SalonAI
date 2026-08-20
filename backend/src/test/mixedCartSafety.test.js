import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { commerceConfig } from "../features/commerce/commerceService.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "../..");
const repoRoot = path.resolve(backendRoot, "..");

function source(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("commerce config exposes the server appointment deposit percentage", () => {
  const previous = process.env.APPOINTMENT_DEPOSIT_PERCENTAGE;
  process.env.APPOINTMENT_DEPOSIT_PERCENTAGE = "30";
  try {
    assert.equal(commerceConfig().appointmentDepositPercentage, 30);
  } finally {
    if (previous === undefined) delete process.env.APPOINTMENT_DEPOSIT_PERCENTAGE;
    else process.env.APPOINTMENT_DEPOSIT_PERCENTAGE = previous;
  }
});

test("mixed settlement checkpoints inventory before appointment allocation", () => {
  const text = source("backend/src/features/commerce/commerceService.js");
  const start = text.indexOf("export async function settlePaidOrder");
  const inventory = text.indexOf("await commitInventory(order);", start);
  const appointment = text.indexOf("await settleAppointmentAllocations(order, providerData);", start);
  assert.ok(start >= 0);
  assert.ok(inventory > start);
  assert.ok(appointment > inventory);
  const commitStart = text.indexOf("async function commitInventory(order)");
  const commitEnd = text.indexOf("async function settleAppointmentAllocations", commitStart);
  const commitBlock = text.slice(commitStart, commitEnd);
  assert.match(commitBlock, /order\.inventoryCommittedAt = new Date\(\);/);
  assert.match(commitBlock, /await order\.save\(\);/);
});

test("generic refunds reject orders containing appointment allocations", () => {
  const text = source("backend/src/features/commerce/orderRefundService.js");
  assert.match(text, /function hasAppointmentAllocations\(order\)/);
  assert.match(text, /Orders containing appointment payments require an allocation-aware manager refund workflow/);
  assert.match(text, /refundReconciliationRequired: true/);
});

test("appointment settlement emits a payment-received notification", () => {
  const notifications = source("backend/src/features/appointments/appointmentNotificationService.js");
  const payments = source("backend/src/features/appointments/appointmentPaymentService.js");
  assert.match(notifications, /export async function notifyAppointmentPaymentReceived/);
  assert.match(payments, /notifyAppointmentPaymentReceived\(appointment\._id/);
});

test("cart obtains the deposit percentage from commerce config", () => {
  const text = source("frontend/src/context/CartContext.jsx");
  assert.match(text, /commerceService\s*\.getConfig\(\)/);
  assert.match(text, /appointmentDepositPercentage/);
  assert.match(text, /appointmentDeposit\(appointment, appointmentDepositPercentage\)/);
});
