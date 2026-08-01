import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";

import * as waitlistController from "./waitlistController.js";

const router =
  express.Router();

/*
|--------------------------------------------------------------------------
| Waiting-list reporting and operations
|--------------------------------------------------------------------------
|
| These routes must appear before "/:id" so Express does not interpret
| "summary", "matches" or "expire" as document identifiers.
|
*/

router.get(
  "/summary",
  asyncHandler(
    waitlistController.summary
  )
);

router.get(
  "/matches",
  asyncHandler(
    waitlistController.matches
  )
);

router.post(
  "/expire",
  asyncHandler(
    waitlistController.expire
  )
);

/*
|--------------------------------------------------------------------------
| Waiting-list collection
|--------------------------------------------------------------------------
*/

router
  .route("/")
  .get(
    asyncHandler(
      waitlistController.list
    )
  )
  .post(
    asyncHandler(
      waitlistController.create
    )
  );

/*
|--------------------------------------------------------------------------
| Convert an entry into an appointment
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/convert",
  asyncHandler(
    waitlistController.convert
  )
);

/*
|--------------------------------------------------------------------------
| Individual waiting-list entry
|--------------------------------------------------------------------------
*/

router
  .route("/:id")
  .get(
    asyncHandler(
      waitlistController.get
    )
  )
  .patch(
    asyncHandler(
      waitlistController.update
    )
  )
  .delete(
    asyncHandler(
      waitlistController.remove
    )
  );

export default router;