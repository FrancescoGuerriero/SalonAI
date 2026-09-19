import {
  processSendGridEventBatch,
} from "./sendGridEventWebhookService.js";

function createControllerError(
  message,
  code
) {
  const error =
    new Error(
      message
    );
  error.statusCode =
    400;
  error.code =
    code;
  return error;
}

export async function receiveSendGridEvents(
  request,
  response,
  next
) {
  try {
    let events;

    try {
      events =
        JSON.parse(
          request.body.toString(
            "utf8"
          )
        );
    } catch {
      throw createControllerError(
        "SendGrid Event Webhook body must contain valid JSON.",
        "SENDGRID_WEBHOOK_JSON_INVALID"
      );
    }

    await processSendGridEventBatch(
      events
    );

    return response
      .status(204)
      .end();
  } catch (error) {
    return next(
      error
    );
  }
}

export default {
  receiveSendGridEvents,
};
