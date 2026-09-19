function text(
  value
) {
  return String(
    value ?? ""
  ).trim();
}

export async function reconcileTwilioStatusAfterProviderPersistence(
  providerMessageId
) {
  const messageId =
    text(
      providerMessageId
    );

  if (!messageId) {
    return {
      attempted: false,
      processed: 0,
      ignored: 0,
      pending: 0,
      failed: 0,
      results: [],
    };
  }

  try {
    const {
      reconcilePendingTwilioStatusEvents,
    } =
      await import(
        "./twilioStatusWebhookService.js"
      );

    const result =
      await reconcilePendingTwilioStatusEvents(
        messageId
      );

    return {
      attempted: true,
      ...result,
    };
  } catch (error) {
    return {
      attempted: true,
      processed: 0,
      ignored: 0,
      pending: 0,
      failed: 1,
      results: [],
      errorCode:
        text(
          error?.code
        ) ||
        "TWILIO_STATUS_RECONCILIATION_FAILED",
    };
  }
}

export default {
  reconcileTwilioStatusAfterProviderPersistence,
};
