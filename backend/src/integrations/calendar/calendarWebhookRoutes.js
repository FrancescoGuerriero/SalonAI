import express from "express";

import {
  handleGoogleCalendarWebhook,
  handleOutlookCalendarWebhook,
} from "./calendarWebhookService.js";
import {
  requestCalendarSyncWake,
} from "./calendarSyncWorkerService.js";

const router = express.Router();

router.use(
  express.json({
    limit: "256kb",
  })
);

function processAfterAcknowledgement(
  operation,
  accepted
) {
  void Promise.resolve()
    .then(operation)
    .then((result) => {
      if (accepted(result)) {
        requestCalendarSyncWake();
      }
    })
    .catch((error) => {
      console.error(
        "Calendar webhook post-acknowledgement processing failed:",
        error
      );
    });
}

router.post(
  "/google",
  (request, response) => {
    const headers =
      request.headers;

    response
      .status(204)
      .end();

    processAfterAcknowledgement(
      () =>
        handleGoogleCalendarWebhook({
          headers,
        }),
      (result) =>
        result.accepted ===
        true
    );
  }
);

router.post(
  "/outlook",
  (request, response) => {
    const validationToken =
      String(
        request.query
          ?.validationToken ||
          ""
      );

    if (validationToken) {
      return response
        .status(200)
        .type("text/plain")
        .send(
          validationToken
        );
    }

    const body =
      request.body;

    response
      .status(202)
      .end();

    processAfterAcknowledgement(
      () =>
        handleOutlookCalendarWebhook({
          body,
        }),
      (result) =>
        result.accepted >
        0
    );

    return undefined;
  }
);

export default router;
