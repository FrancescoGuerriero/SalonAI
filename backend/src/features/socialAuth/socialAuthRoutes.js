import express from "express";

import {
  callback,
  providers,
  start,
} from "./socialAuthController.js";
import {
  authRateLimiter,
} from "../../middleware/securityMiddleware.js";

const router = express.Router();

router.get(
  "/providers",
  providers
);

router.post(
  "/:provider/start",
  authRateLimiter,
  start
);

router.get(
  "/:provider/callback",
  authRateLimiter,
  callback
);

export default router;
