import express from "express";

import {
  closeDailyCloseController,
  getDailyCloseHistory,
  getDailyCloseSnapshot,
  reopenDailyCloseController,
  saveDailyCloseDraftController,
} from "../controllers/dailyCloseController.js";

import {
  authorize,
  managementOnly,
  protect,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(managementOnly);

router.get("/", getDailyCloseSnapshot);
router.get("/history", getDailyCloseHistory);

router.put(
  "/draft",
  authorize("admin", "manager"),
  saveDailyCloseDraftController
);

router.post(
  "/close",
  authorize("admin", "manager"),
  closeDailyCloseController
);

router.post(
  "/reopen",
  authorize("admin", "manager"),
  reopenDailyCloseController
);

export default router;
