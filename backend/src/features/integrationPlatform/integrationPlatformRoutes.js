import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import partnerMarketplaceRoutes from "../partnerMarketplace/partnerMarketplaceRoutes.js";
import marketingDataCoreRoutes from "./marketingDataCoreRoutes.js";
import * as controller from "./integrationPlatformController.js";
import * as connectedAccountsController from "./socialConnectedAccountsController.js";

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

/*
|--------------------------------------------------------------------------
| Tenant connected accounts
|--------------------------------------------------------------------------
|
| This customer-facing management surface intentionally hides IntegrationApp
| and CredentialVersion implementation details. Provider secrets remain
| write-only and encrypted by providerCredentialService.
*/
router.get(
  "/connected-accounts",
  read,
  asyncHandler(connectedAccountsController.connectedAccounts)
);
router.put(
  "/connected-accounts/:provider",
  write,
  asyncHandler(connectedAccountsController.connectAccount)
);
router.post(
  "/connected-accounts/:provider/disconnect",
  write,
  asyncHandler(connectedAccountsController.disconnectAccount)
);

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
  "/apps/:appId/connections/:connectionId/provider-credentials",
  read,
  asyncHandler(controller.providerCredentials)
);
router.post(
  "/apps/:appId/connections/:connectionId/provider-credentials",
  write,
  asyncHandler(controller.storeProviderConnectionCredential)
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
