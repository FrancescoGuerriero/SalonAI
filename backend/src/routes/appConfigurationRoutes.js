import express from "express";

import asyncHandler from "../middleware/asyncHandler.js";
import { getPublicFeatureConfiguration } from "../controllers/appConfigurationController.js";

const router = express.Router();

router.get("/features", asyncHandler(getPublicFeatureConfiguration));

export default router;
