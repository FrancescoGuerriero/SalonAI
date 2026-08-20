import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import Payment from "../features/commerce/Payment.js";
import {
  createAppointmentCheckoutPayment,
} from "../providers/paymentProvider.js";
import {
  confirmDemoAppointmentPayment,
  createAppointmentCheckout,
  failAppointmentPayment,
  settleAppointmentPayment,
} from "../features/appointments/appointmentPaymentService.js";
import {
  notifyAppointmentPaymentReceived,
} from "../features/appointments/appointmentPaymentNotificationService.js";
import appointmentManagementRoutes from "../features/appointments/appointmentManagementRoutes.js";

const appointmentPaymentServiceSource =
  readFileSync(
    new URL(
      "../features/appointments/appointmentPaymentService.js",
      import.meta.url
    ),
    "utf8"
  );

const paymentProviderSource =
  readFileSync(
    new URL(
      "../providers/paymentProvider.js",
      import.meta.url
    ),
    "utf8"
  );

test(
  "payment provider exposes appointment Checkout Sessions",
  () => {
    assert.equal(
      typeof createAppointmentCheckoutPayment,
      "function"
    );
  }
);

test(
  "appointment payment service exposes checkout and reconciliation lifecycle",
  () => {
    assert.equal(
      typeof createAppointmentCheckout,
      "function"
    );
    assert.equal(
      typeof settleAppointmentPayment,
      "function"
    );
    assert.equal(
      typeof failAppointmentPayment,
      "function"
    );
    assert.equal(
      typeof confirmDemoAppointmentPayment,
      "function"
    );
    assert.equal(
      typeof notifyAppointmentPaymentReceived,
      "function"
    );
  }
);

test(
  "shared Payment model supports appointment deposit and balance purposes",
  () => {
    const purpose =
      Payment.schema.path("purpose");

    assert.ok(
      purpose.enumValues.includes(
        "appointment_deposit"
      )
    );

    assert.ok(
      purpose.enumValues.includes(
        "appointment_balance"
      )
    );
  }
);

test(
  "appointment management router contains payment endpoints",
  () => {
    const paths =
      appointmentManagementRoutes.stack
        .map(
          (layer) =>
            layer.route?.path
        )
        .filter(Boolean);

    assert.ok(
      paths.includes(
        "/:id/payments/checkout"
      )
    );

    assert.ok(
      paths.includes(
        "/:id/payments/:paymentId/confirm-demo"
      )
    );
  }
);

test(
  "Payment checkout reservation key is unique and sparse",
  () => {
    const path =
      Payment.schema.path(
        "checkoutReservationKey"
      );

    assert.ok(path);

    assert.equal(
      path.options.unique,
      true
    );

    assert.equal(
      path.options.sparse,
      true
    );
  }
);

test(
  "Payment checkout reservation key normalises null and blank values",
  () => {
    const base = {
      purpose:
        "appointment_deposit",
      amount: 10,
    };

    const missing =
      new Payment(base);

    const explicitNull =
      new Payment({
        ...base,
        checkoutReservationKey:
          null,
      });

    const blank =
      new Payment({
        ...base,
        checkoutReservationKey:
          "   ",
      });

    assert.equal(
      missing.checkoutReservationKey,
      undefined
    );

    assert.equal(
      explicitNull.checkoutReservationKey,
      undefined
    );

    assert.equal(
      blank.checkoutReservationKey,
      undefined
    );
  }
);

test(
  "Payment checkout reservation key trims real values",
  () => {
    const payment =
      new Payment({
        purpose:
          "appointment_deposit",
        amount: 10,
        checkoutReservationKey:
          "  appointment_checkout:abc:appointment_deposit  ",
      });

    assert.equal(
      payment.checkoutReservationKey,
      "appointment_checkout:abc:appointment_deposit"
    );
  }
);

test(
  "appointment payment service reserves payment before provider checkout",
  () => {
    const reservationPosition =
      appointmentPaymentServiceSource.indexOf(
        "reserveAppointmentPayment"
      );

    const providerPosition =
      appointmentPaymentServiceSource.indexOf(
        "createAppointmentCheckoutPayment",
        reservationPosition
      );

    assert.ok(
      reservationPosition >= 0,
      "reservation helper is missing"
    );

    assert.ok(
      providerPosition >
        reservationPosition,
      "provider checkout must occur after reservation"
    );

    assert.match(
      appointmentPaymentServiceSource,
      /checkoutReservationKey\s*:/
    );

    assert.match(
      appointmentPaymentServiceSource,
      /Payment\.create/
    );
  }
);

test(
  "appointment payment reservation handles duplicate-key races",
  () => {
    assert.match(
      appointmentPaymentServiceSource,
      /error\?\.code\s*!==\s*11000/
    );

    assert.match(
      appointmentPaymentServiceSource,
      /checkoutReservationKey[\s\S]*reservationKey/
    );

    assert.match(
      appointmentPaymentServiceSource,
      /winner[\s\S]*reused:\s*true/
    );
  }
);

test(
  "appointment payment service releases reservation after terminal outcomes",
  () => {
    const releases =
      appointmentPaymentServiceSource.match(
        /payment\.checkoutReservationKey\s*=\s*undefined;/g
      ) || [];

    assert.ok(
      releases.length >= 2,
      "paid and failed payment paths must release the reservation key"
    );
  }
);

test(
  "appointment checkout passes deterministic provider idempotency key",
  () => {
    assert.match(
      appointmentPaymentServiceSource,
      /providerIdempotencyKey/
    );

    assert.match(
      appointmentPaymentServiceSource,
      /salonai:appointment-payment:/
    );

    assert.match(
      appointmentPaymentServiceSource,
      /idempotencyKey\s*:/
    );
  }
);

test(
  "Stripe appointment checkout forwards idempotency key as request option",
  () => {
    assert.match(
      paymentProviderSource,
      /idempotencyKey\s*=\s*""/
    );

    assert.match(
      paymentProviderSource,
      /requestIdempotencyKey/
    );

    assert.match(
      paymentProviderSource,
      /\{\s*idempotencyKey:\s*requestIdempotencyKey\s*\}/
    );
  }
);
