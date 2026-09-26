import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import * as controller from "./templateController.js";

const router = express.Router();

router
  .route("/")
  .get(asyncHandler(controller.list))
  .post(
    requirePermissions("communications:manage"),
    asyncHandler(controller.create)
  );

router.post(
  "/:id/preview",
  asyncHandler(controller.preview)
);

router.patch(
  "/:id/archive",
  requirePermissions("communications:manage"),
  asyncHandler(controller.archive)
);

router
  .route("/:id")
  .get(asyncHandler(controller.get))
  .patch(
    requirePermissions("communications:manage"),
    asyncHandler(controller.update)
  );

export default router;
