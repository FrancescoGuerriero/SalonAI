import express from "express";

import {
  getSchedulerStatus,
  restartScheduler,
  runSchedulerNow,
  startScheduler,
  stopScheduler,
} from "../controllers/messageDeliverySchedulerController.js";

import {
  managementOnly,
  protect,
} from "../middleware/authMiddleware.js";

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
  runSchedulerNow
);

/*
|--------------------------------------------------------------------------
| Scheduler lifecycle controls
|--------------------------------------------------------------------------
*/

router.post(
  "/start",
  startScheduler
);

router.post(
  "/stop",
  stopScheduler
);

router.post(
  "/restart",
  restartScheduler
);

export default router;