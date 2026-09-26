import express from "express";

import {
  getSchedulerStatus,
  restartScheduler,
  runSchedulerNow,
  startScheduler,
  stopScheduler,
} from "../controllers/messageDeliverySchedulerController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  requireAnyPermission,
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Scheduler access control
|--------------------------------------------------------------------------
|
| Scheduler operations can start background processing and trigger real
| outbound communications. Only authenticated management users may access
| these endpoints.
|
*/

router.use(protect);
router.use(managementOnly);

/*
|--------------------------------------------------------------------------
| Scheduler status
|--------------------------------------------------------------------------
|
| Returns runtime state, interval configuration, cycle counters, the most
| recent cycle result and the latest scheduler error.
|
*/

router.get(
  "/status",
  readCommunications,
  getSchedulerStatus
);

/*
|--------------------------------------------------------------------------
| Manual scheduler cycle
|--------------------------------------------------------------------------
|
| Processes due campaigns and deferred message retries immediately without
| requiring the recurring scheduler to be enabled.
|
*/

router.post(
  "/run",
  manageCommunications,
  runSchedulerNow
);

/*
|--------------------------------------------------------------------------
| Scheduler lifecycle controls
|--------------------------------------------------------------------------
*/

router.post(
  "/start",
  manageCommunications,
  startScheduler
);

router.post(
  "/stop",
  manageCommunications,
  stopScheduler
);

router.post(
  "/restart",
  manageCommunications,
  restartScheduler
);

export default router;