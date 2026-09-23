import express from "express";

import {
  protect,
} from "../../middleware/authMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import { requireFeature } from "../../services/featureControlService.js";
import * as controller from "./servicePackageController.js";

const router = express.Router();

/*
 * Public catalogue returns only active + published package definitions.
 * Entitlements are always resolved from the authenticated user's linked
 * Customer record so customers cannot enumerate another customer's packages.
 */
router.get(
  "/",
  requireFeature("service-packages"),
  asyncHandler(
    controller.listPublishedDefinitions
  )
);

router.get(
  "/mine",
  protect,
  asyncHandler(
    controller.myEntitlements
  )
);

export default router;
