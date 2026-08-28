import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import test from "node:test";

import StripeWebhookEvent from "../features/commerce/StripeWebhookEvent.js";
import {
  claimStripeWebhookEvent,
} from "../features/commerce/stripeWebhookEventService.js";

function replaceMethod(
  object,
  name,
  replacement,
  context
) {
  const original =
    object[name];

  object[name] =
    replacement;

  context.after(
    () => {
      object[name] =
        original;
    }
  );
}

function duplicateError() {
  const error =
    new Error("duplicate");

  error.code =
    11000;

  return error;
}

const webhookSource =
  readFileSync(
    new URL(
      "../features/commerce/stripeWebhookService.js",
      import.meta.url
    ),
    "utf8"
  );

test(
  "Stripe webhook event IDs are unique and receipts expire",
  () => {
    const indexes =
      StripeWebhookEvent
        .schema
        .indexes();

    assert.ok(
      indexes.some(
        ([fields, options]) =>
          fields.eventId === 1 &&
          options.unique === true
      )
    );

    assert.ok(
      indexes.some(
        ([fields, options]) =>
          fields.expiresAt === 1 &&
          options.expireAfterSeconds === 0
      )
    );
  }
);

test(
  "first Stripe delivery receives a processing claim",
  async (context) => {
    let created;

    replaceMethod(
      StripeWebhookEvent,
      "create",
      async (document) => {
        created =
          document;

        return document;
      },
      context
    );

    const claim =
      await claimStripeWebhookEvent(
        {
          id:
            "evt_first",
          type:
            "checkout.session.completed",
          livemode:
            true,
          data: {
            object: {
              id:
                "cs_first",
            },
          },
        }
      );

    assert.equal(
      claim.claimed,
      true
    );

    assert.equal(
      claim.duplicate,
      false
    );

    assert.equal(
      created.eventId,
      "evt_first"
    );

    assert.equal(
      created.status,
      "processing"
    );

    assert.ok(
      created.claimId
    );
  }
);

test(
  "processed Stripe delivery is treated as duplicate",
  async (context) => {
    replaceMethod(
      StripeWebhookEvent,
      "create",
      async () => {
        throw duplicateError();
      },
      context
    );

    replaceMethod(
      StripeWebhookEvent,
      "findOneAndUpdate",
      async () => null,
      context
    );

    replaceMethod(
      StripeWebhookEvent,
      "findOne",
      async () => ({
        eventId:
          "evt_done",
        status:
          "processed",
      }),
      context
    );

    const claim =
      await claimStripeWebhookEvent(
        {
          id:
            "evt_done",
          type:
            "checkout.session.completed",
          data: {
            object: {
              id:
                "cs_done",
            },
          },
        }
      );

    assert.equal(
      claim.claimed,
      false
    );

    assert.equal(
      claim.duplicate,
      true
    );
  }
);

test(
  "simultaneous duplicate remains retryable",
  async (context) => {
    replaceMethod(
      StripeWebhookEvent,
      "create",
      async () => {
        throw duplicateError();
      },
      context
    );

    replaceMethod(
      StripeWebhookEvent,
      "findOneAndUpdate",
      async () => null,
      context
    );

    replaceMethod(
      StripeWebhookEvent,
      "findOne",
      async () => ({
        eventId:
          "evt_busy",
        status:
          "processing",
      }),
      context
    );

    await assert.rejects(
      () =>
        claimStripeWebhookEvent(
          {
            id:
              "evt_busy",
            type:
              "checkout.session.completed",
            data: {
              object: {
                id:
                  "cs_busy",
              },
            },
          }
        ),
      (error) => {
        assert.equal(
          error.statusCode,
          409
        );

        assert.equal(
          error.code,
          "STRIPE_WEBHOOK_IN_PROGRESS"
        );

        assert.equal(
          error.retryable,
          true
        );

        return true;
      }
    );
  }
);

test(
  "failed Stripe delivery can be reclaimed",
  async (context) => {
    replaceMethod(
      StripeWebhookEvent,
      "create",
      async () => {
        throw duplicateError();
      },
      context
    );

    replaceMethod(
      StripeWebhookEvent,
      "findOneAndUpdate",
      async (filter, update) => {
        if (
          filter.status ===
          "failed"
        ) {
          return {
            eventId:
              "evt_retry",
            status:
              "processing",
            claimId:
              update.$set.claimId,
          };
        }

        return null;
      },
      context
    );

    const claim =
      await claimStripeWebhookEvent(
        {
          id:
            "evt_retry",
          type:
            "checkout.session.completed",
          data: {
            object: {
              id:
                "cs_retry",
            },
          },
        }
      );

    assert.equal(
      claim.claimed,
      true
    );

    assert.equal(
      claim.reclaimed,
      true
    );
  }
);

test(
  "Stripe signature verification occurs before event claiming",
  () => {
    const handlerStart =
      webhookSource.indexOf(
        "export async function handleStripeCheckoutWebhook"
      );

    assert.ok(
      handlerStart >= 0
    );

    const handler =
      webhookSource.slice(
        handlerStart
      );

    const signaturePosition =
      handler.indexOf(
        "constructStripeEvent("
      );

    const claimPosition =
      handler.indexOf(
        "claimStripeWebhookEvent("
      );

    assert.ok(
      signaturePosition >= 0
    );

    assert.ok(
      claimPosition >
        signaturePosition
    );
  }
);

test(
  "completed duplicates bypass Stripe settlement processing",
  () => {
    assert.match(
      webhookSource,
      /if\s*\(\s*!claim\.claimed\s*\)/
    );

    assert.match(
      webhookSource,
      /duplicate:\s*true/
    );

    assert.match(
      webhookSource,
      /markStripeWebhookEventProcessed\(\s*event\.id,\s*claim\.claimId\s*\)/
    );

    assert.match(
      webhookSource,
      /markStripeWebhookEventFailed\(\s*event\.id,\s*claim\.claimId,\s*error\s*\)/
    );
  }
);