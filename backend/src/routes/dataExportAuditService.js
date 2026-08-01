import {
  Router,
} from "express";

import {
  getCustomerValueAnalytics,
} from "./customerValueController.js";

const router = Router();

router.get(
  "/",
  getCustomerValueAnalytics
);

export default router;