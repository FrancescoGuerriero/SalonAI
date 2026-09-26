import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import * as controller from "./segmentController.js";

const router = express.Router();

router
  .route("/")
  .get(asyncHandler(controller.list))
  .post(
    requirePermissions("customer:update"),
    asyncHandler(controller.create)
  );

router.get(
  "/:id/preview",
  asyncHandler(controller.preview)
);

router
  .route("/:id")
  .get(asyncHandler(controller.get))
  .patch(
    requirePermissions("customer:update"),
    asyncHandler(controller.update)
  )
  .delete(
    requirePermissions("customer:update"),
    asyncHandler(controller.remove)
  );

export default router;
