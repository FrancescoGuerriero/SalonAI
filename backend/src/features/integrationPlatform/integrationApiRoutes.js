import express from "express";

import ConnectorHealth from "../../models/ConnectorHealth.js";
import asyncHandler from "../../shared/asyncHandler.js";
import {
  authenticateIntegrationApp,
  requireIntegrationScopes,
} from "./integrationApiAuth.js";
import {
  listDomainEventSchemas,
} from "./domainEventCatalogue.js";
import {
  integrationScopeCatalogue,
} from "./integrationScopeCatalogue.js";

const router = express.Router();

router.use(asyncHandler(authenticateIntegrationApp));

router.get(
  "/",
  requireIntegrationScopes("integration:read"),
  (request, response) => {
    response.json({
      api: "AIIBP Integration API",
      version: "1",
      app: {
        id: request.integrationAuth.appId,
        key: request.integrationAuth.appKey,
        environment: request.integrationAuth.environment,
        scopes: request.integrationAuth.scopes,
      },
      ratePolicy: request.integrationAuth.ratePolicy,
      endpoints: {
        scopeCatalogue: "/api/integrations/v1/scopes",
        eventCatalogue: "/api/integrations/v1/events",
        connectorHealth: "/api/integrations/v1/health",
      },
    });
  }
);

router.get(
  "/scopes",
  requireIntegrationScopes("integration:read"),
  (_request, response) => {
    response.json({
      version: "1",
      items: integrationScopeCatalogue(),
    });
  }
);

router.get(
  "/events",
  requireIntegrationScopes("events:read"),
  (_request, response) => {
    response.json({
      version: "1",
      items: listDomainEventSchemas(),
    });
  }
);

router.get(
  "/health",
  requireIntegrationScopes("integration:read"),
  asyncHandler(async (request, response) => {
    const items = await ConnectorHealth.find({
      business: request.integrationAuth.businessId,
      app: request.integrationAuth.appId,
    })
      .sort({ updatedAt: -1, _id: 1 })
      .lean();

    response.json({
      version: "1",
      items,
    });
  })
);

export default router;
