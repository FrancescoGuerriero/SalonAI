import * as service from "./campaignService.js";
import {
  createCampaignExecution,
  listCampaignExecutions,
} from "./growthCampaignService.js";
import {
  createSocialPublication,
  listSocialPublications,
  publishSocialPublication,
  queueSocialPublication,
  socialPublishingStatus,
} from "./socialPublishingService.js";
import { campaignPerformance } from "./campaignPerformanceService.js";
import { createServiceError } from "../../shared/serviceError.js";

function businessId(request) {
  const value =
    request.effectiveAuthority?.businessId ||
    request.tenantContext?.businessId ||
    null;
  if (!value) {
    throw createServiceError(
      "A trusted active business is required for campaign operations.",
      400
    );
  }
  return value;
}

function locationId(request) {
  const value =
    request.effectiveAuthority?.locationId ||
    request.tenantContext?.locationId ||
    null;
  if (!value) {
    throw createServiceError(
      "Select a location before using cross-channel campaign execution, social publishing or performance.",
      400,
      { code: "LOCATION_REQUIRED" }
    );
  }
  return value;
}

function campaignAuthority(request) {
  return {
    businessId: businessId(request),
    locationId: locationId(request),
  };
}

function actorUser(request) {
  return request.user?._id || request.user?.id || null;
}

export async function create(req, res) {
  res.status(201).json(
    await service.createCampaign(req.body || {}, req.user, {
      businessId: businessId(req),
    })
  );
}

export async function list(req, res) {
  res.json(
    await service.listCampaigns(req.query || {}, {
      businessId: businessId(req),
    })
  );
}

export async function get(req, res) {
  res.json(
    await service.getCampaign(req.params.id, {
      businessId: businessId(req),
    })
  );
}

export async function update(req, res) {
  res.json(
    await service.updateCampaign(
      req.params.id,
      req.body || {},
      req.user,
      { businessId: businessId(req) }
    )
  );
}

export async function preview(req, res) {
  res.json(
    await service.previewCampaign(req.params.id, {
      businessId: businessId(req),
    })
  );
}

export async function performance(req, res) {
  res.json(
    await campaignPerformance(
      req.params.id,
      req.query || {},
      campaignAuthority(req)
    )
  );
}

export async function schedule(req, res) {
  res.json(
    await service.scheduleCampaign(
      req.params.id,
      req.body?.scheduledFor,
      campaignAuthority(req)
    )
  );
}

export async function cancel(req, res) {
  res.json(
    await service.cancelCampaign(req.params.id, campaignAuthority(req))
  );
}

export async function jobs(req, res) {
  res.json(
    await service.campaignJobs(
      req.params.id,
      req.query || {},
      campaignAuthority(req)
    )
  );
}

export async function executions(req, res) {
  res.json({
    items: await listCampaignExecutions(
      req.params.id,
      req.query || {},
      campaignAuthority(req)
    ),
  });
}

export async function createExecution(req, res) {
  res.status(201).json(
    await createCampaignExecution(
      req.params.id,
      req.body || {},
      {
        ...campaignAuthority(req),
        actorUser: actorUser(req),
      }
    )
  );
}

export async function publications(req, res) {
  res.json({
    items: await listSocialPublications(
      req.params.id,
      req.query || {},
      campaignAuthority(req)
    ),
    publishing: socialPublishingStatus(),
  });
}

export async function createPublication(req, res) {
  res.status(201).json(
    await createSocialPublication(
      req.params.id,
      req.body || {},
      {
        ...campaignAuthority(req),
        actorUser: actorUser(req),
      }
    )
  );
}

export async function queuePublication(req, res) {
  res.json(
    await queueSocialPublication(
      req.params.id,
      req.params.publicationId,
      {
        ...campaignAuthority(req),
        actorUser: actorUser(req),
      }
    )
  );
}

export async function publishPublication(req, res) {
  res.json(
    await publishSocialPublication(
      req.params.id,
      req.params.publicationId,
      {
        ...campaignAuthority(req),
        actorUser: actorUser(req),
      }
    )
  );
}
