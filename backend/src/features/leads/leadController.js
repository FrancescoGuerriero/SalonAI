import {
  addLeadTimelineEvent,
  captureLead,
  convertLeadToCustomer,
  createOpportunity,
  getLeadAggregate,
  listLeads,
  scoreLead,
  setLeadNurture,
  updateLead,
  updateOpportunity,
} from "./leadService.js";
import {
  attributionForLead,
  recordAttributionTouch,
  recordLeadCaptureAttribution,
  recordLeadConversionAttribution,
} from "../campaigns/growthCampaignService.js";
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
      "A trusted active business is required for lead operations.",
      400
    );
  }
  return value;
}

function locationId(request) {
  return (
    request.effectiveAuthority?.locationId ||
    request.tenantContext?.locationId ||
    null
  );
}

function actorUser(request) {
  return request.user?._id || request.user?.id || null;
}

function body(request) {
  return request.body &&
    typeof request.body === "object" &&
    !Array.isArray(request.body)
    ? request.body
    : {};
}

async function attributionOutcome(operation) {
  try {
    const touch = await operation();
    return {
      status: touch ? "recorded" : "not_required",
      touch,
    };
  } catch (error) {
    // Lead/customer mutations are already transactional before attribution is
    // projected. Never turn a successful canonical mutation into an ambiguous
    // client retry. Surface the unresolved projection for explicit repair.
    return {
      status: "unresolved",
      code: error.code || "ATTRIBUTION_PROJECTION_FAILED",
      message: error.message,
    };
  }
}

export async function leads(request, response) {
  response.json({
    items: await listLeads(request.query || {}, {
      businessId: businessId(request),
    }),
  });
}

export async function lead(request, response) {
  response.json(
    await getLeadAggregate(request.params.leadId, {
      businessId: businessId(request),
    })
  );
}

export async function capture(request, response) {
  const tenantBusinessId = businessId(request);
  const payload = body(request);
  const result = await captureLead(payload, {
    businessId: tenantBusinessId,
    locationId: locationId(request),
    actorUser: actorUser(request),
  });
  const attribution = await attributionOutcome(() =>
    recordLeadCaptureAttribution(result.lead, payload, {
      businessId: tenantBusinessId,
    })
  );

  response.status(201).json({
    ...result,
    attribution,
  });
}

export async function update(request, response) {
  response.json(
    await updateLead(request.params.leadId, body(request), {
      businessId: businessId(request),
      actorUser: actorUser(request),
    })
  );
}

export async function timeline(request, response) {
  response.status(201).json(
    await addLeadTimelineEvent(request.params.leadId, body(request), {
      businessId: businessId(request),
      actorUser: actorUser(request),
    })
  );
}

export async function score(request, response) {
  response.status(201).json(
    await scoreLead(request.params.leadId, body(request), {
      businessId: businessId(request),
      actorUser: actorUser(request),
    })
  );
}

export async function nurture(request, response) {
  response.json(
    await setLeadNurture(request.params.leadId, body(request), {
      businessId: businessId(request),
      actorUser: actorUser(request),
    })
  );
}

export async function convert(request, response) {
  const tenantBusinessId = businessId(request);
  const result = await convertLeadToCustomer(request.params.leadId, body(request), {
    businessId: tenantBusinessId,
    actorUser: actorUser(request),
  });
  const attribution = await attributionOutcome(() =>
    recordLeadConversionAttribution(result.lead, result.customer, {
      businessId: tenantBusinessId,
    })
  );

  response.status(201).json({
    ...result,
    attribution,
  });
}

export async function addOpportunity(request, response) {
  const tenantBusinessId = businessId(request);
  const payload = body(request);
  const opportunity = await createOpportunity(request.params.leadId, payload, {
    businessId: tenantBusinessId,
    actorUser: actorUser(request),
  });
  const attribution = await attributionOutcome(() =>
    recordAttributionTouch(
      {
        ...payload.attribution,
        lead: request.params.leadId,
        opportunity: opportunity._id,
        customer: opportunity.customer || undefined,
        campaign: payload.campaignId || payload.attribution?.campaign,
        campaignKey: payload.campaignKey || payload.attribution?.campaignKey,
        touchType: "opportunity",
        channel: payload.sourceChannel || payload.attribution?.channel || "other",
        externalReference: payload.attribution?.externalReference,
      },
      { businessId: tenantBusinessId }
    )
  );

  response.status(201).json({
    opportunity,
    attribution,
  });
}

export async function editOpportunity(request, response) {
  response.json(
    await updateOpportunity(
      request.params.leadId,
      request.params.opportunityId,
      body(request),
      {
        businessId: businessId(request),
        actorUser: actorUser(request),
      }
    )
  );
}

export async function attribution(request, response) {
  response.json(
    await attributionForLead(request.params.leadId, {
      businessId: businessId(request),
    })
  );
}

export async function addAttribution(request, response) {
  response.status(201).json(
    await recordAttributionTouch(
      {
        ...body(request),
        lead: request.params.leadId,
      },
      { businessId: businessId(request) }
    )
  );
}

export default {
  addAttribution,
  addOpportunity,
  attribution,
  capture,
  convert,
  editOpportunity,
  lead,
  leads,
  nurture,
  score,
  timeline,
  update,
};
