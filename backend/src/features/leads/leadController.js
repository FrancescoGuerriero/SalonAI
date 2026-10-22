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
  response.status(201).json(
    await captureLead(body(request), {
      businessId: businessId(request),
      locationId: locationId(request),
      actorUser: actorUser(request),
    })
  );
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
  response.status(201).json(
    await convertLeadToCustomer(request.params.leadId, body(request), {
      businessId: businessId(request),
      actorUser: actorUser(request),
    })
  );
}

export async function addOpportunity(request, response) {
  response.status(201).json(
    await createOpportunity(request.params.leadId, body(request), {
      businessId: businessId(request),
      actorUser: actorUser(request),
    })
  );
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

export default {
  addOpportunity,
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
