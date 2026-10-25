import express from "express";

import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./dataHubController.js";

const router = express.Router();
const read = requirePermissions("feature-control:read");
const write = requirePermissions("feature-control:update");

router.get("/catalogue", read, asyncHandler(controller.catalogue));
router.get("/overview", read, asyncHandler(controller.overview));
router.get("/fields", read, asyncHandler(controller.fields));
router.post("/query", read, asyncHandler(controller.query));
router.post("/ai-evidence", read, asyncHandler(controller.aiEvidence));

router.get("/saved-views", read, asyncHandler(controller.savedViews));
router.post("/saved-views", write, asyncHandler(controller.createSavedView));
router.patch("/saved-views/:viewId", write, asyncHandler(controller.updateSavedView));
router.post("/saved-views/:viewId/query", read, asyncHandler(controller.runSavedView));

router.get("/destinations", read, asyncHandler(controller.destinations));
router.post("/destinations", write, asyncHandler(controller.createDestination));
router.patch("/destinations/:taskId", write, asyncHandler(controller.updateDestination));
router.post("/destinations/:taskId/preview", write, asyncHandler(controller.previewDestination));
router.get("/destination-runs", read, asyncHandler(controller.destinationRuns));

export default router;
