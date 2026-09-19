import express from "express";

import asyncHandler from "../middleware/asyncHandler.js";
import {
  getPublicFeatureConfiguration,
  getPublicPlatformConfiguration,
} from "../controllers/appConfigurationController.js";

const router = express.Router();

router.get("/features", asyncHandler(getPublicFeatureConfiguration));
router.get("/platform", getPublicPlatformConfiguration);

export default router;
