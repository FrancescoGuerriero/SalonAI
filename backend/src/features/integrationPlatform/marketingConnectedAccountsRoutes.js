import express from "express";

import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./marketingConnectedAccountsController.js";
import * as windsorController from "./windsorConnectorController.js";

const router = express.Router();
const read = requirePermissions("feature-control:read");
const write = requirePermissions("feature-control:update");

router.get("/catalogue", read, asyncHandler(controller.catalogue));
router.get("/accounts", read, asyncHandler(controller.accounts));
router.put("/accounts/:provider", write, asyncHandler(controller.configure));
router.post("/accounts/:provider/verify", write, asyncHandler(controller.verify));
router.post("/accounts/:provider/disconnect", write, asyncHandler(controller.disconnect));

// Point 12 Windsor read/analytics connector layer. Windsor authorization links
// handle provider OAuth/manual setup; provider passwords are never accepted here.
router.get("/windsor/catalogue", read, asyncHandler(windsorController.catalogue));
router.post("/windsor/:connector/authorize", write, asyncHandler(windsorController.authorize));
router.post("/windsor/:connector/reconcile", write, asyncHandler(windsorController.reconcile));
router.get("/windsor/:connector/fields", read, asyncHandler(windsorController.fields));
router.get("/windsor/:connector/profiles", read, asyncHandler(windsorController.profiles));
router.post("/windsor/:connector/preview", read, asyncHandler(windsorController.preview));
router.post("/windsor/:connector/import", write, asyncHandler(windsorController.importToDataHub));
router.post("/windsor/:connector/backfill", write, asyncHandler(windsorController.backfill));
router.get("/windsor/:connector/seller-kpis", read, asyncHandler(windsorController.sellerKpis));
router.delete("/windsor/:connector/accounts/:accountId", write, asyncHandler(windsorController.unlinkAccount));

export default router;