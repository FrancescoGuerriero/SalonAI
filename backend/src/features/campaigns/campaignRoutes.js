import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import * as controller from "./campaignController.js";

const router = express.Router();

router
  .route("/")
  .get(asyncHandler(controller.list))
  .post(
    requirePermissions("communications:manage"),
    asyncHandler(controller.create)
  );

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
  requirePermissions("communications:manage"),
  asyncHandler(controller.schedule)
);

router.post(
  "/:id/cancel",
  requirePermissions("communications:manage"),
  asyncHandler(controller.cancel)
);

router
  .route("/:id")
  .get(asyncHandler(controller.get))
  .patch(
    requirePermissions("communications:manage"),
    asyncHandler(controller.update)
  );

export default router;
