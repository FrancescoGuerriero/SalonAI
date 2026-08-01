import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./campaignController.js";

const router = express.Router();

router
  .route("/")
  .get(asyncHandler(controller.list))
  .post(asyncHandler(controller.create));

router.get(
  "/:id/preview",
  asyncHandler(controller.preview)
);

router.get(
  "/:id/jobs",
  asyncHandler(controller.jobs)
);

router.post(
  "/:id/schedule",
  asyncHandler(controller.schedule)
);

router.post(
  "/:id/cancel",
  asyncHandler(controller.cancel)
);

router
  .route("/:id")
  .get(asyncHandler(controller.get))
  .patch(asyncHandler(controller.update));

export default router;
