import express from "express";

import ConnectorHealth from "../../models/ConnectorHealth.js";
import asyncHandler from "../../shared/asyncHandler.js";
import {
  captureLead,
  listLeads,
} from "../leads/leadService.js";
import {
  normaliseLeadAcquisitionPayload,
} from "../leads/leadSourceMappingService.js";
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
const API_ROOT = "/api/future/integrations/v1";

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
        scopeCatalogue: `${API_ROOT}/scopes`,
        eventCatalogue: `${API_ROOT}/events`,
        connectorHealth: `${API_ROOT}/health`,
        leads: `${API_ROOT}/leads`,
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

router.get(
  "/leads",
  requireIntegrationScopes("lead:read"),
  asyncHandler(async (request, response) => {
    const items = await listLeads(request.query || {}, {
      businessId: request.integrationAuth.businessId,
    });
    response.json({ version: "1", items });
  })
);

router.post(
  "/leads",
  requireIntegrationScopes("lead:write"),
  asyncHandler(async (request, response) => {
    const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
      ? request.body
      : {};
    const payload = normaliseLeadAcquisitionPayload({
      ...body,
      sourceSystem: body.sourceSystem || request.integrationAuth.appKey,
      metadata: {
        ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}),
        integration: {
          appId: request.integrationAuth.appId,
          appKey: request.integrationAuth.appKey,
          credentialId: request.integrationAuth.credentialId,
          credentialVersion: request.integrationAuth.credentialVersion,
        },
      },
    });
    const result = await captureLead(payload, {
      businessId: request.integrationAuth.businessId,
      locationId: null,
      actorUser: null,
    });
    response.status(201).json({ version: "1", ...result });
  })
);

export default router;
