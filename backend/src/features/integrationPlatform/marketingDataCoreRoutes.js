import express from "express";

import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./marketingDataCoreController.js";

const router = express.Router();
const read = requirePermissions("feature-control:read");
const write = requirePermissions("feature-control:update");

router.get("/catalogue", read, asyncHandler(controller.catalogue));
router.get("/overview", read, asyncHandler(controller.overview));
router.get("/sources", read, asyncHandler(controller.sources));
router.post("/sources", write, asyncHandler(controller.createSource));
router.patch("/sources/:sourceId", write, asyncHandler(controller.updateSource));
router.post("/sources/:sourceId/preview", write, asyncHandler(controller.preview));
router.post("/sources/:sourceId/runs", write, asyncHandler(controller.runSource));
router.get("/runs", read, asyncHandler(controller.runs));
router.get("/seo-observations", read, asyncHandler(controller.seoObservations));

export default router;
