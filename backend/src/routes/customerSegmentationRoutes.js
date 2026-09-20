import express from "express";

import {
  getSegmentDefinitions,
  getSegmentOverview,
  getSegmentCustomers,
} from "../controllers/customerSegmentationController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(
  requirePermissions(
    "customer:read"
  )
);

router.get(
  "/definitions",
  getSegmentDefinitions
);

router.get(
  "/overview",
  getSegmentOverview
);

router.get(
  "/customers",
  getSegmentCustomers
);

export default router;