import * as service from "./integrationPlatformService.js";
import {
  createServiceError,
} from "../../shared/serviceError.js";

function businessId(request) {
  const value =
    request.effectiveAuthority?.businessId ||
    request.tenantContext?.businessId ||
    null;
  if (!value) {
    throw createServiceError(
      "A trusted active business is required for integration operations.",
      400
    );
  }
  return value;
}

function actorId(request) {
  return request.user?._id || request.user?.id || null;
}

function body(request) {
  return request.body &&
    typeof request.body === "object" &&
    !Array.isArray(request.body)
    ? request.body
    : {};
}

export async function apps(request, response) {
  response.json({
    items: await service.listIntegrationApps(request.query || {}, {
      businessId: businessId(request),
    }),
  });
}

export async function createApp(request, response) {
  response.status(201).json(
    await service.createIntegrationApp(body(request), {
      businessId: businessId(request),
      ownerUser: actorId(request),
    })
  );
}

export async function updateApp(request, response) {
  response.json(
    await service.updateIntegrationApp(
      request.params.appId,
      body(request),
      { businessId: businessId(request) }
    )
  );
}

export async function credentials(request, response) {
  response.json({
    items: await service.listIntegrationCredentials(
      request.params.appId,
      { businessId: businessId(request) }
    ),
  });
}

export async function issueCredential(request, response) {
  response.status(201).json(
    await service.issueIntegrationCredential(
      request.params.appId,
      body(request),
      { businessId: businessId(request) }
    )
  );
}

export async function revokeCredential(request, response) {
  response.json(
    await service.revokeIntegrationCredential(
      request.params.appId,
      request.params.credentialId,
      { businessId: businessId(request) }
    )
  );
}

export async function connections(request, response) {
  response.json({
    items: await service.listIntegrationConnections(
      request.params.appId,
      { businessId: businessId(request) }
    ),
  });
}

export async function createConnection(request, response) {
  response.status(201).json(
    await service.createIntegrationConnection(
      request.params.appId,
      body(request),
      { businessId: businessId(request) }
    )
  );
}

export async function subscriptions(request, response) {
  response.json({
    items: await service.listWebhookSubscriptions(
      request.params.appId,
      { businessId: businessId(request) }
    ),
  });
}

export async function createSubscription(request, response) {
  response.status(201).json(
    await service.createWebhookSubscription(
      request.params.appId,
      body(request),
      { businessId: businessId(request) }
    )
  );
}

export async function updateSubscription(request, response) {
  response.json(
    await service.updateWebhookSubscription(
      request.params.appId,
      request.params.subscriptionId,
      body(request),
      { businessId: businessId(request) }
    )
  );
}

export async function deliveries(request, response) {
  response.json({
    items: await service.listWebhookDeliveries(request.query || {}, {
      businessId: businessId(request),
    }),
  });
}

export async function replayDelivery(request, response) {
  response.status(201).json(
    await service.replayTenantWebhookDelivery(
      request.params.deliveryId,
      { businessId: businessId(request) }
    )
  );
}

export async function health(request, response) {
  response.json({
    items: await service.listConnectorHealth(request.query || {}, {
      businessId: businessId(request),
    }),
  });
}

export async function eventCatalogue(_request, response) {
  response.json({
    items: service.integrationEventCatalogue(),
  });
}

export default {
  apps,
  connections,
  createApp,
  createConnection,
  createSubscription,
  credentials,
  deliveries,
  eventCatalogue,
  health,
  issueCredential,
  replayDelivery,
  revokeCredential,
  subscriptions,
  updateApp,
  updateSubscription,
};
