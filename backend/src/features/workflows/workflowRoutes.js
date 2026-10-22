import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import * as controller from "./workflowController.js";

const router = express.Router();
const manage = requirePermissions("retention-automation:manage");
const read = requirePermissions("customer:read");

router.get("/", read, asyncHandler(controller.definitions));
router.post("/", manage, asyncHandler(controller.createDefinition));
router.get("/:workflowId", read, asyncHandler(controller.definition));
router.patch(
  "/:workflowId/status",
  manage,
  asyncHandler(controller.changeStatus)
);
router.get("/runs/list", read, asyncHandler(controller.runs));
router.post(
  "/runs/:runId/resume",
  manage,
  asyncHandler(controller.resumeRun)
);
router.post(
  "/runtime/tick",
  manage,
  asyncHandler(controller.processTick)
);

export default router;
