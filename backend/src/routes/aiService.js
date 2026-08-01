import express from "express";

import { adminOnly } from "../../middleware/authMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./securityController.js";

const router = express.Router();

router.use(adminOnly);

router.get(
  "/audit-logs",
  asyncHandler(controller.auditLogs)
);

router.get(
  "/permissions",
  asyncHandler(controller.permissions)
);

export default router;
