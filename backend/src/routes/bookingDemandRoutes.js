import {
  Router,
} from "express";

import {
  getServicePerformance,
} from "./servicePerformanceController.js";

const router = Router();

router.get(
  "/",
  getServicePerformance
);

export default router;
