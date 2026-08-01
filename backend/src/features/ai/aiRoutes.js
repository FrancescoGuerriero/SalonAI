import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";

import * as aiController from "./aiController.js";

const router =
  express.Router();

/*
|--------------------------------------------------------------------------
| Customer-retention prediction reporting
|--------------------------------------------------------------------------
|
| Static routes must appear before routes containing ":customerId".
|
*/

router.get(
  "/retention/summary",
  asyncHandler(
    aiController.retentionSummary
  )
);

router.get(
  "/retention/predictions",
  asyncHandler(
    aiController.retentionPredictions
  )
);

router.post(
  "/retention/batch",
  asyncHandler(
    aiController.retentionBatch
  )
);

/*
|--------------------------------------------------------------------------
| Individual customer-retention prediction
|--------------------------------------------------------------------------
|
| GET retrieves the currently stored prediction.
| POST generates or refreshes the customer's prediction.
|
*/

router
  .route(
    "/customers/:customerId/retention"
  )
  .get(
    asyncHandler(
      aiController.storedRetention
    )
  )
  .post(
    asyncHandler(
      aiController.retention
    )
  );

/*
|--------------------------------------------------------------------------
| AI campaign-writing assistant
|--------------------------------------------------------------------------
*/

router.post(
  "/campaign-copy",
  asyncHandler(
    aiController.copy
  )
);

/*
|--------------------------------------------------------------------------
| Revenue forecasting
|--------------------------------------------------------------------------
*/

router
  .route(
    "/revenue-forecast"
  )
  .get(
    asyncHandler(
      aiController.latestForecast
    )
  )
  .post(
    asyncHandler(
      aiController.forecast
    )
  );

export default router;