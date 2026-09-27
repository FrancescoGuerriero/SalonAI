import express from "express";

import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./securityController.js";

const router =
  express.Router();

router.get(
  "/audit-logs",
  requirePermissions(
    "security:audit:read"
  ),
  asyncHandler(
    controller.auditLogs
  )
);

router.get(
  "/permissions",
  requirePermissions(
    "staff-role:read"
  ),
  asyncHandler(
    controller.permissions
  )
);

export default router;
