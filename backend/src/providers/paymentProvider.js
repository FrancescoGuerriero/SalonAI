import Stripe from "stripe";

export function paymentProviderMode() {
  const configured = String(
    process.env.PAYMENT_PROVIDER_MODE || "console"
  ).toLowerCase();

  return ["mock", "console", "demo"].includes(configured)
    ? "console"
    : configured;
}

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const error = new Error(
      "STRIPE_SECRET_KEY is not configured."
    );

    error.statusCode = 500;
    throw error;
  }

  return new Stripe(
    process.env.STRIPE_SECRET_KEY
  );
}

function normaliseMetadata(metadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(
        ([, value]) =>
          value !== undefined &&
          value !== null
      )
      .map(([key, value]) => [
        key,
        String(value),
      ])
  );
}

/**
 * Compatibility payment method used by older
 * appointment and order payment services.
 */
export async function createProviderPayment({
  amount,
  currency = "GBP",
  metadata = {},
}) {
  const paymentAmount = Number(amount);

  if (
    !Number.isFinite(paymentAmount) ||
    paymentAmount <= 0
  ) {
    const error = new Error(
      "Payment amount must be greater than zero."
    );

    error.statusCode = 400;
    throw error;
  }

  if (
    paymentProviderMode() === "console"
  ) {
    return {
      provider: "console",

      providerPaymentId:
        `console_payment_${Date.now()}`,

      clientSecret: "",

      status: "pending",

      rawStatus: "demo_pending",
    };
  }

  const stripe = stripeClient();

  const intent =
    await stripe.paymentIntents.create({
      amount: Math.round(
        paymentAmount * 100
      ),

      currency: String(currency)
        .trim()
        .toLowerCase(),

      automatic_payment_methods: {
        enabled: true,
      },

      metadata:
        normaliseMetadata(metadata),
    });

  return {
    provider: "stripe",

    providerPaymentId:
      intent.id,

    clientSecret:
      intent.client_secret || "",

    status:
      intent.status === "succeeded"
        ? "paid"
        : "pending",

    rawStatus:
      intent.status || "",
  };
}

export async function createCheckoutPayment({
  order,
  items,
  customerEmail,
  successUrl,
  cancelUrl,
}) {
  if (
    paymentProviderMode() === "console"
  ) {
    const id =
      `console_checkout_${Date.now()}`;

    return {
      provider: "console",
      providerPaymentId: id,
      checkoutUrl: "",
      status: "pending",
      rawStatus: "demo_pending",
    };
  }

  const stripe = stripeClient();

  const session =
    await stripe.checkout.sessions.create({
      mode: "payment",

      customer_email:
        customerEmail || undefined,

      line_items: items.map(
        (item) => ({
          quantity:
            item.quantity,

          price_data: {
            currency: String(
              order.currency || "GBP"
            ).toLowerCase(),

            unit_amount: Math.round(
              Number(item.unitPrice) *
                100
            ),

            product_data: {
              name: item.name,

              description:
                item.sku,

              images: item.image
                ? [item.image]
                : undefined,
            },
          },
        })
      ),

      success_url: successUrl,
      cancel_url: cancelUrl,

      metadata: {
        orderId:
          String(order._id),

        orderNumber:
          order.orderNumber,

        userId:
          String(order.user || ""),
      },

      payment_intent_data: {
        metadata: {
          orderId:
            String(order._id),

          orderNumber:
            order.orderNumber,
        },
      },
    });

  return {
    provider: "stripe",

    providerPaymentId:
      session.id,

    providerIntentId:
      typeof session.payment_intent ===
      "string"
        ? session.payment_intent
        : session.payment_intent?.id ||
          "",

    checkoutUrl:
      session.url || "",

    status:
      session.payment_status === "paid"
        ? "paid"
        : "pending",

    rawStatus:
      session.status || "",
  };
}

export function constructStripeEvent(
  rawBody,
  signature
) {
  if (
    paymentProviderMode() !== "stripe"
  ) {
    const error = new Error(
      "Stripe webhooks are disabled in console payment mode."
    );

    error.statusCode = 400;
    throw error;
  }

  if (
    !process.env
      .STRIPE_WEBHOOK_SECRET
  ) {
    const error = new Error(
      "STRIPE_WEBHOOK_SECRET is not configured."
    );

    error.statusCode = 500;
    throw error;
  }

  if (!signature) {
    const error = new Error(
      "The Stripe-Signature header is required."
    );

    error.statusCode = 400;
    throw error;
  }

  return stripeClient()
    .webhooks
    .constructEvent(
      rawBody,
      signature,
      process.env
        .STRIPE_WEBHOOK_SECRET
    );
}