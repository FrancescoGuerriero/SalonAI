import express from "express";

import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./marketingConnectedAccountsController.js";

const router = express.Router();
const read = requirePermissions("feature-control:read");
const write = requirePermissions("feature-control:update");

router.get("/catalogue", read, asyncHandler(controller.catalogue));
router.get("/accounts", read, asyncHandler(controller.accounts));
router.put("/accounts/:provider", write, asyncHandler(controller.configure));
router.post("/accounts/:provider/disconnect", write, asyncHandler(controller.disconnect));

export default router;
