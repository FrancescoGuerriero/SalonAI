import { Router } from "express";

import { authorize } from "../../middleware/authMiddleware.js";
import {
  assignRetailSale,
  getStaffPerformance,
  unassignRetailSale,
  updateStaffCompensationPlan,
} from "./staffPerformanceController.js";

const router = Router();
const managerOrAdmin = authorize("admin", "manager");

router.get("/", getStaffPerformance);

router.put(
  "/stylists/:stylistId/plan",
  managerOrAdmin,
  updateStaffCompensationPlan
);

router.patch(
  "/retail-orders/:orderId/assignment",
  managerOrAdmin,
  assignRetailSale
);

router.delete(
  "/retail-orders/:orderId/assignment",
  managerOrAdmin,
  unassignRetailSale
);

export default router;
