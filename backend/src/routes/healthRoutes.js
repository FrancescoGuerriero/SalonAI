import express from "express";
import {
  dependencies,
  live,
  metrics,
  ready,
} from "../controllers/healthController.js";
import { protect } from "../middleware/authMiddleware.js";
import { managementOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", live);
router.get("/live", live);
router.get("/ready", ready);
router.get(
  "/dependencies",
  protect,
  managementOnly,
  dependencies
);
router.get(
  "/metrics",
  protect,
  managementOnly,
  metrics
);

export default router;
