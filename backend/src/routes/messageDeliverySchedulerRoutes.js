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

const router =
  express.Router();

const readCommunications =
  requireAnyPermission(
    "communications:read",
    "communications:manage"
  );

const manageCommunications =
  requirePermissions(
    "communications:manage"
  );

/*
|--------------------------------------------------------------------------
| Scheduler access control
|--------------------------------------------------------------------------
|
| Scheduler operations can start background processing and trigger real
| outbound communications. Access is capability-based:
| - status requires communications read or manage;
| - run/start/stop/restart require communications:manage.
|
*/

router.use(
  protect
);

/*
|--------------------------------------------------------------------------
| Scheduler status
|--------------------------------------------------------------------------
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
