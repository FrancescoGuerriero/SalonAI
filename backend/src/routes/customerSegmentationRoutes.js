import express from "express";

import {
  getSegmentDefinitions,
  getSegmentOverview,
  getSegmentCustomers,
} from "../controllers/customerSegmentationController.js";

import {
  protect,
  managementOnly,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(managementOnly);

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