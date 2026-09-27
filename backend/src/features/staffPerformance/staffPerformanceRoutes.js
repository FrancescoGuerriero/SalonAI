import { Router } from "express";

import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import {
  assignRetailSale,
  getStaffPerformance,
  unassignRetailSale,
  updateStaffCompensationPlan,
} from "./staffPerformanceController.js";

const router = Router();
router.get("/", getStaffPerformance);

router.put(
  "/stylists/:stylistId/plan",
  requirePermissions("reports:manage"),
  updateStaffCompensationPlan
);

router.patch(
  "/retail-orders/:orderId/assignment",
  requirePermissions("reports:manage"),
  assignRetailSale
);

router.delete(
  "/retail-orders/:orderId/assignment",
  requirePermissions("reports:manage"),
  unassignRetailSale
);

export default router;
