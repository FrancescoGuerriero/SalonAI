import {
  handleStripeCheckoutWebhook,
} from "./stripeWebhookService.js";

export async function stripeCheckoutWebhook(
  request,
  response
) {
  const result =
    await handleStripeCheckoutWebhook(
      request.body,
      request.headers[
        "stripe-signature"
      ]
    );

  return response.json(
    result
  );
}

export default {
  stripeCheckoutWebhook,
};
