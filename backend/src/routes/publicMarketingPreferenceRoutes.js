import express from "express";

import asyncHandler from "../middleware/asyncHandler.js";
import {
  getPublicMarketingPreferences,
  unsubscribePublicMarketing,
} from "../controllers/publicMarketingPreferenceController.js";

const router = express.Router();

router.get(
  "/:token",
  asyncHandler(
    getPublicMarketingPreferences
  )
);

router.post(
  "/:token/unsubscribe",
  asyncHandler(
    unsubscribePublicMarketing
  )
);

router.post(
  "/:token/unsubscribe/:channel",
  asyncHandler(
    unsubscribePublicMarketing
  )
);

export default router;
