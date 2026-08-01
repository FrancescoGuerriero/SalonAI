import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./templateController.js";

const router = express.Router();

router
  .route("/")
  .get(asyncHandler(controller.list))
  .post(asyncHandler(controller.create));

router.post(
  "/:id/preview",
  asyncHandler(controller.preview)
);

router.patch(
  "/:id/archive",
  asyncHandler(controller.archive)
);

router
  .route("/:id")
  .get(asyncHandler(controller.get))
  .patch(asyncHandler(controller.update));

export default router;
