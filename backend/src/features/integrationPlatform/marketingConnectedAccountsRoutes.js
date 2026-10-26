import express from "express";

import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./marketingConnectedAccountsController.js";
import * as dataConnectionController from "./dataConnectionController.js";

const router = express.Router();
const read = requirePermissions("feature-control:read");
const write = requirePermissions("feature-control:update");

router.get("/catalogue", read, asyncHandler(controller.catalogue));
router.get("/accounts", read, asyncHandler(controller.accounts));
router.put("/accounts/:provider", write, asyncHandler(controller.configure));
router.post("/accounts/:provider/verify", write, asyncHandler(controller.verify));
router.post("/accounts/:provider/disconnect", write, asyncHandler(controller.disconnect));

// Point 12 AIIBP managed data-connection layer. Provider OAuth/manual setup
// occurs through the configured connection adapter; provider passwords are
// never accepted by these application routes.
router.get("/data-connections/catalogue", read, asyncHandler(dataConnectionController.catalogue));
router.post("/data-connections/:connector/authorize", write, asyncHandler(dataConnectionController.authorize));
router.post("/data-connections/:connector/reconcile", write, asyncHandler(dataConnectionController.reconcile));
router.get("/data-connections/:connector/fields", read, asyncHandler(dataConnectionController.fields));
router.get("/data-connections/:connector/profiles", read, asyncHandler(dataConnectionController.profiles));
router.post("/data-connections/:connector/preview", read, asyncHandler(dataConnectionController.preview));
router.post("/data-connections/:connector/import", write, asyncHandler(dataConnectionController.importToDataHub));
router.post("/data-connections/:connector/backfill", write, asyncHandler(dataConnectionController.backfill));
router.get("/data-connections/:connector/seller-kpis", read, asyncHandler(dataConnectionController.sellerKpis));
router.delete("/data-connections/:connector/accounts/:accountId", write, asyncHandler(dataConnectionController.unlinkAccount));

export default router;
