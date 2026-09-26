import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import * as controller from "./schedulerController.js";

const router = express.Router();

router.get("/", asyncHandler(controller.list));
router.post(
  "/process",
  requirePermissions("communications:manage"),
  asyncHandler(controller.process)
);
router.post(
  "/:id/cancel",
  requirePermissions("communications:manage"),
  asyncHandler(controller.cancel)
);

export default router;
