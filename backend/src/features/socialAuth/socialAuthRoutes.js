import express from "express";

import {
  callback,
  links,
  providers,
  start,
  startLink,
  unlink,
} from "./socialAuthController.js";
import {
  authRateLimiter,
} from "../../middleware/securityMiddleware.js";
import {
  protect,
} from "../../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/providers",
  providers
);

router.get(
  "/links",
  protect,
  links
);

router.post(
  "/:provider/link",
  protect,
  authRateLimiter,
  startLink
);

router.delete(
  "/:provider/link",
  protect,
  authRateLimiter,
  unlink
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
