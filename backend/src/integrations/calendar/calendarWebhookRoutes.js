import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
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

router.post(
  "/google",
  asyncHandler(async (request, response) => {
    const result = await handleGoogleCalendarWebhook({
      headers: request.headers,
    });

    response.status(204).end();

    if (result.accepted) {
      requestCalendarSyncWake();
    }
  })
);

router.post(
  "/outlook",
  asyncHandler(async (request, response) => {
    const validationToken = String(
      request.query?.validationToken || ""
    );

    if (validationToken) {
      return response
        .status(200)
        .type("text/plain")
        .send(validationToken);
    }

    const result = await handleOutlookCalendarWebhook({
      body: request.body,
    });

    response.status(202).end();

    if (result.accepted > 0) {
      requestCalendarSyncWake();
    }

    return undefined;
  })
);

export default router;
