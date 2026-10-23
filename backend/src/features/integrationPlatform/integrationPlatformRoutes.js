import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import partnerMarketplaceRoutes from "../partnerMarketplace/partnerMarketplaceRoutes.js";
import marketingDataCoreRoutes from "./marketingDataCoreRoutes.js";
import * as controller from "./integrationPlatformController.js";

const router = express.Router();
const read = requirePermissions("feature-control:read");
const write = requirePermissions("feature-control:update");

router.use(
  "/marketplace",
  partnerMarketplaceRoutes
);

router.use(
  "/marketing-data",
  marketingDataCoreRoutes
);

router.get("/stage-5-contract", read, asyncHandler(controller.stage5ContractCatalogue));
router.get("/apps", read, asyncHandler(controller.apps));
router.post("/apps", write, asyncHandler(controller.createApp));
router.patch("/apps/:appId", write, asyncHandler(controller.updateApp));

router.get(
  "/apps/:appId/credentials",
  read,
  asyncHandler(controller.credentials)
);
router.post(
  "/apps/:appId/credentials",
  write,
  asyncHandler(controller.issueCredential)
);
router.post(
  "/apps/:appId/credentials/:credentialId/revoke",
  write,
  asyncHandler(controller.revokeCredential)
);

router.get(
  "/apps/:appId/connections",
  read,
  asyncHandler(controller.connections)
);
router.post(
  "/apps/:appId/connections",
  write,
  asyncHandler(controller.createConnection)
);

router.get(
  "/apps/:appId/webhooks",
  read,
  asyncHandler(controller.subscriptions)
);
router.post(
  "/apps/:appId/webhooks",
  write,
  asyncHandler(controller.createSubscription)
);
router.patch(
  "/apps/:appId/webhooks/:subscriptionId",
  write,
  asyncHandler(controller.updateSubscription)
);

router.get(
  "/webhook-deliveries",
  read,
  asyncHandler(controller.deliveries)
);
router.post(
  "/webhook-deliveries/:deliveryId/replay",
  write,
  asyncHandler(controller.replayDelivery)
);
router.get("/health", read, asyncHandler(controller.health));
router.get("/events", read, asyncHandler(controller.eventCatalogue));
router.get("/scopes", read, asyncHandler(controller.scopeCatalogue));

export default router;
