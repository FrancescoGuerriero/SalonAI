import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("Stage 3 payment-request contract reuses canonical appointment checkout", () => {
  const paymentRequest = source(
    "../features/appointments/appointmentPaymentRequestService.js"
  );
  const appointmentRoutes = source(
    "../features/appointments/appointmentManagementRoutes.js"
  );

  assert.match(paymentRequest, /createAppointmentCheckout/);
  assert.match(paymentRequest, /deliveryMode:\s*"customer_transactional_preference"/);
  assert.doesNotMatch(paymentRequest, /new\s+Stripe|stripeClient|Payment\.create/);
  assert.match(appointmentRoutes, /\/:id\/payment-requests/);
  assert.match(appointmentRoutes, /appointment:payment:manage/);
});

test("Stage 3 invoice lifecycle is canonical across appointments and orders", () => {
  const model = source("../features/commerce/Invoice.js");
  const service = source("../features/commerce/invoiceService.js");
  const appointmentRoutes = source(
    "../features/appointments/appointmentManagementRoutes.js"
  );
  const commerceRoutes = source("../features/commerce/commerceRoutes.js");

  assert.match(model, /sourceType/);
  assert.match(model, /"appointment",\s*"order"/);
  assert.match(model, /"partially_paid"/);
  assert.match(model, /"partially_refunded"/);
  assert.match(model, /invoiceNumber/);
  assert.match(model, /discountTotal/);
  assert.match(model, /deliveryFee/);
  assert.doesNotMatch(model, /\bPAN\b|\bCVV\b|cardNumber|securityCode/i);

  assert.match(service, /issueAppointmentInvoice/);
  assert.match(service, /issueOrderInvoice/);
  assert.match(service, /paymentSummary/);
  assert.match(service, /amountRefunded/);
  assert.match(service, /persistAppointmentCompatibilityNumber/);
  assert.match(service, /createInvoiceOnce/);

  assert.match(appointmentRoutes, /\/:id\/invoice/);
  assert.match(commerceRoutes, /\/orders\/:id\/invoice/);
  assert.match(commerceRoutes, /requirePermissions\("order:read"\)/);
  assert.match(commerceRoutes, /requirePermissions\("order:update"\)/);
});

test("order invoice counts the canonical parent payment instead of mixed-cart allocations", () => {
  const service = source("../features/commerce/invoiceService.js");

  assert.match(service, /async function orderPaymentSummary/);
  assert.match(service, /_id:\s*order\.payment\?\._id \|\| order\.payment/);
  assert.match(service, /appointment:\s*\{ \$exists: false \}/);
  assert.match(service, /orderSubtotal/);
});

test("Stage 3 invoice reconciliation never executes provider payments", () => {
  const service = source("../features/commerce/invoiceService.js");

  assert.doesNotMatch(service, /createCheckoutPayment/);
  assert.doesNotMatch(service, /createAppointmentCheckoutPayment/);
  assert.doesNotMatch(service, /refundProviderPayment/);
  assert.doesNotMatch(service, /paymentIntents\.create/);
});
