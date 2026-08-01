import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./segmentController.js";

const router = express.Router();

router
  .route("/")
  .get(asyncHandler(controller.list))
  .post(asyncHandler(controller.create));

router.get(
  "/:id/preview",
  asyncHandler(controller.preview)
);

router
  .route("/:id")
  .get(asyncHandler(controller.get))
  .patch(asyncHandler(controller.update))
  .delete(asyncHandler(controller.remove));

export default router;
