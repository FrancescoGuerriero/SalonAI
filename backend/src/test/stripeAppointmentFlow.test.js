import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appointmentPaymentSource =
  readFileSync(
    new URL(
      "../features/appointments/appointmentPaymentService.js",
      import.meta.url
    ),
    "utf8"
  );

const stripeWebhookSource =
  readFileSync(
    new URL(
      "../features/commerce/stripeWebhookService.js",
      import.meta.url
    ),
    "utf8"
  );

const frontendAppSource =
  readFileSync(
    new URL(
      "../../../frontend/src/App.jsx",
      import.meta.url
    ),
    "utf8"
  );

test(
  "appointment Stripe Checkout returns to the customer account",
  () => {
    assert.ok(
      appointmentPaymentSource.includes(
        '`${frontendUrl}/account?payment=success&appointment=${appointment._id}&session_id={CHECKOUT_SESSION_ID}`'
      )
    );

    assert.ok(
      appointmentPaymentSource.includes(
        '`${frontendUrl}/account?payment=cancelled&appointment=${appointment._id}`'
      )
    );

    assert.equal(
      appointmentPaymentSource.includes(
        "/appointments/${appointment._id}/payment/success"
      ),
      false
    );
  }
);

test(
  "customer account payment return route is protected",
  () => {
    assert.match(
      frontendAppSource,
      /path="account"[\s\S]{0,250}protectedPage\(\s*CustomerAccountPage/
    );
  }
);

test(
  "expired Stripe Checkout releases its reservation",
  () => {
    const start =
      stripeWebhookSource.indexOf(
        "async function markExpired"
      );

    const end =
      stripeWebhookSource.indexOf(
        "function completedSessionIsPaid",
        start
      );

    assert.ok(start >= 0);
    assert.ok(end > start);

    const block =
      stripeWebhookSource.slice(
        start,
        end
      );

    assert.match(
      block,
      /payment\.status\s*=\s*"cancelled";/
    );

    assert.match(
      block,
      /payment\.checkoutReservationKey\s*=\s*undefined;/
    );

    const releasePosition =
      block.indexOf(
        "payment.checkoutReservationKey"
      );

    const savePosition =
      block.indexOf(
        "await payment.save();"
      );

    assert.ok(
      releasePosition >= 0 &&
      releasePosition < savePosition,
      "reservation must be released before the expired payment is saved"
    );
  }
);
