import {
  createClientTechnicalRecord,
  listClientTechnicalRecords,
  listRetentionQueue,
} from "./stage9CrmService.js";
import {
  buildPoint9Customer360,
  listPoint9RetentionOpportunities,
} from "./stage9Customer360Service.js";

function actorId(request) {
  return request?.user?._id || request?.user?.id || null;
}

export async function getTechnicalRecords(request, response) {
  const result = await listClientTechnicalRecords(request.params.customerId, {
    effectiveAuthority: request.effectiveAuthority,
    limit: request.query.limit,
  });
  response.status(200).json(result);
}

export async function createTechnicalRecord(request, response) {
  const record = await createClientTechnicalRecord(
    request.params.customerId,
    request.body || {},
    {
      effectiveAuthority: request.effectiveAuthority,
      actorId: actorId(request),
    }
  );
  response.status(201).json({ record });
}

export async function getRetentionQueue(request, response) {
  const result = await listRetentionQueue({
    effectiveAuthority: request.effectiveAuthority,
    limit: request.query.limit,
    state: request.query.state || "",
  });
  response.status(200).json(result);
}

export async function getPoint9Customer360(request, response) {
  const projection = await buildPoint9Customer360(request.params.customerId, {
    tenantContext: request.tenantContext,
    effectiveAuthority: request.effectiveAuthority,
  });
  response.status(200).json({ projection });
}

export async function getRetentionOpportunities(request, response) {
  const result = await listPoint9RetentionOpportunities({
    tenantContext: request.tenantContext,
    effectiveAuthority: request.effectiveAuthority,
    type: request.query.type || "",
    limit: request.query.limit,
  });
  response.status(200).json(result);
}
