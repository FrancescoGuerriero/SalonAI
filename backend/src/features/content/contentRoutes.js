import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import { protect } from "../../middleware/authMiddleware.js";
import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import * as controller from "./contentController.js";

const router = express.Router();

router.get("/pages/:slug", asyncHandler(controller.publicPage));

router.use("/management", protect);
router.get(
  "/management/pages",
  requirePermissions("customer-experience:read"),
  asyncHandler(controller.listPages)
);
router.post(
  "/management/pages",
  requirePermissions("customer-experience:manage"),
  asyncHandler(controller.createPage)
);
router.patch(
  "/management/pages/:id",
  requirePermissions("customer-experience:manage"),
  asyncHandler(controller.updatePage)
);
router.get(
  "/management/pages/:id/preview",
  requirePermissions("customer-experience:read"),
  asyncHandler(controller.previewPage)
);
router.post(
  "/management/pages/:id/publish",
  requirePermissions("customer-experience:manage"),
  asyncHandler(controller.publishPage)
);
router.post(
  "/management/pages/:id/archive",
  requirePermissions("customer-experience:manage"),
  asyncHandler(controller.archivePage)
);

export default router;
