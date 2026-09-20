import express from "express";

import {
  closeDailyCloseController,
  getDailyCloseHistory,
  getDailyCloseSnapshot,
  reopenDailyCloseController,
  saveDailyCloseDraftController,
} from "../controllers/dailyCloseController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

const router = express.Router();

router.use(protect);

router.get(
  "/",
  requirePermissions(
    "reports:read"
  ),
  getDailyCloseSnapshot
);
router.get(
  "/history",
  requirePermissions(
    "reports:read"
  ),
  getDailyCloseHistory
);

router.put(
  "/draft",
  requirePermissions(
    "reports:manage"
  ),
  saveDailyCloseDraftController
);

router.post(
  "/close",
  requirePermissions(
    "reports:manage"
  ),
  closeDailyCloseController
);

router.post(
  "/reopen",
  requirePermissions(
    "reports:manage"
  ),
  reopenDailyCloseController
);

export default router;
